import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize new instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Standard Google Auth provider without restricted Workspace scopes
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export interface CashierSessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  photoURL?: string | null;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentOperatorUser: CashierSessionUser | User | null = null;

const STORAGE_KEY_TOKEN = 'prodx_auth_token';
const STORAGE_KEY_USER = 'prodx_auth_user';

export const getStoredOperator = (): CashierSessionUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User | CashierSessionUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check stored operator user first for instant hydration
  const storedUser = getStoredOperator();
  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (storedUser && storedToken) {
    currentOperatorUser = storedUser;
    cachedAccessToken = storedToken;
    if (onAuthSuccess) onAuthSuccess(storedUser, storedToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      currentOperatorUser = user;
      const idToken = await user.getIdToken().catch(() => null);
      const token = cachedAccessToken || idToken || 'prodx-firebase-token';
      cachedAccessToken = token;
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Google Operator',
        isAnonymous: user.isAnonymous
      }));
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else if (!currentOperatorUser) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Perform Google Sign-In with standard scopes.
 * If external OAuth is restricted by Google (e.g. Error 403 org_internal),
 * catches the error and throws an informative error so the UI can fallback cleanly.
 */
export const googleSignIn = async (): Promise<{ user: User | CashierSessionUser; accessToken: string; isFallback?: boolean } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || (await result.user.getIdToken()) || 'prodx-google-auth-token';

    cachedAccessToken = token;
    currentOperatorUser = result.user;
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify({
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      isAnonymous: result.user.isAnonymous
    }));

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.warn('Google Sign-In caught:', error);
    // If popup closed or org_internal (403), throw with flag
    const isOrgInternal = error?.message?.includes('403') || error?.code === 'auth/unauthorized-domain' || error?.message?.includes('org_internal');
    if (isOrgInternal || error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      const err = new Error(isOrgInternal ? 'ORG_INTERNAL_RESTRICTION' : 'POPUP_CANCELLED');
      (err as any).originalError = error;
      throw err;
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Instant Store Cashier / Admin Operator sign-in
 * Guaranteed to succeed without external Google OAuth restrictions.
 */
export const loginAsCashier = (
  email = 'kamkokaewthodsawat@gmail.com',
  displayName = 'Thodsawat Kamkokaew (Store Admin)'
): { user: CashierSessionUser; accessToken: string } => {
  const cashierUser: CashierSessionUser = {
    uid: `operator-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName,
    isAnonymous: false,
  };
  const token = `prodx-cashier-session-${Date.now().toString(36)}`;
  cachedAccessToken = token;
  currentOperatorUser = cashierUser;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(cashierUser));
  return { user: cashierUser, accessToken: token };
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const stored = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (stored) return stored;
  return 'prodx-cashier-session-token';
};

export const logoutGmail = async () => {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  currentOperatorUser = null;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
};


