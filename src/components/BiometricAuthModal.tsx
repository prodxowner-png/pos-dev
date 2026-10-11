import React from 'react';
import { BiometricAuthorization } from './BiometricAuthorization';
import { BiometricAuthResult } from '../types/prodx';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actionLabel?: string;
  targetDescription?: string;
  onAuthorized: (result: {
    method: 'WEBAUTHN_BIOMETRIC' | 'PIN';
    biometricAuth?: BiometricAuthResult;
    supervisorPin?: string;
    supervisorName: string;
  }) => void;
}

export const BiometricAuthModal: React.FC<BiometricAuthModalProps> = ({
  isOpen,
  onClose,
  title = 'Supervisor Biometric Authorization',
  actionLabel = 'SUPERVISOR OVERRIDE',
  targetDescription,
  onAuthorized,
}) => {
  return (
    <BiometricAuthorization
      isOpen={isOpen}
      mode="modal"
      title={title}
      actionLabel={actionLabel}
      targetDescription={targetDescription}
      onAuthorized={(authData) => {
        onAuthorized(authData);
        onClose();
      }}
      onClose={onClose}
      onCancel={onClose}
      allowPinFallback={true}
    />
  );
};
