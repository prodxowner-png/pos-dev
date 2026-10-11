import React, { useState, useRef, useCallback } from 'react';
import { ProductItem } from '../../types/prodx';
import { InventoryItemContextMenu, ContextMenuPosition } from './InventoryItemContextMenu';
import { UpdateStockModal } from './UpdateStockModal';
import { GenerateReorderModal } from './GenerateReorderModal';
import { InventoryAuditTrailModal } from './InventoryAuditTrailModal';

export type QuickActionType = 'UPDATE_STOCK' | 'GENERATE_REORDER' | 'VIEW_AUDIT';

export interface QuickActionsState {
  isMenuOpen: boolean;
  selectedItem: ProductItem | null;
  position: ContextMenuPosition;
  activeModal: QuickActionType | null;
  suggestedQty?: number;
}

export function useInventoryQuickActions() {
  const [state, setState] = useState<QuickActionsState>({
    isMenuOpen: false,
    selectedItem: null,
    position: { x: 0, y: 0 },
    activeModal: null,
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number; item: ProductItem } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const openMenu = useCallback((item: ProductItem, position: ContextMenuPosition, suggestedQty?: number) => {
    setState({
      isMenuOpen: true,
      selectedItem: item,
      position,
      activeModal: null,
      suggestedQty,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setState((prev) => ({ ...prev, isMenuOpen: false }));
  }, []);

  const openActionModal = useCallback((action: QuickActionType, item: ProductItem, suggestedQty?: number) => {
    setState((prev) => ({
      ...prev,
      isMenuOpen: false,
      selectedItem: item,
      activeModal: action,
      suggestedQty: suggestedQty ?? prev.suggestedQty,
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, activeModal: null }));
  }, []);

  // Right-click event handler
  const handleContextMenu = useCallback((e: React.MouseEvent, item: ProductItem, suggestedQty?: number) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(item, { x: e.clientX, y: e.clientY }, suggestedQty);
  }, [openMenu]);

  // Touch long-press handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, item: ProductItem, suggestedQty?: number) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      item,
    };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
        openMenu(
          touchStartRef.current.item,
          { x: touchStartRef.current.x, y: touchStartRef.current.y },
          suggestedQty
        );
        touchStartRef.current = null;
      }
    }, 450); // 450ms long-press threshold
  }, [openMenu]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    // Cancel if finger moves more than 10px (e.g. scroll gesture)
    if (dx > 10 || dy > 10) {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      touchStartRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchStartRef.current = null;
  }, []);

  // Button click trigger (e.g. 3-dots icon)
  const handleQuickActionClick = useCallback((e: React.MouseEvent, item: ProductItem, suggestedQty?: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(item, { x: rect.left, y: rect.bottom + 6 }, suggestedQty);
  }, [openMenu]);

  return {
    state,
    openMenu,
    closeMenu,
    openActionModal,
    closeModal,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleQuickActionClick,
  };
}

interface InventoryQuickActionControllerProps {
  state: QuickActionsState;
  onCloseMenu: () => void;
  onCloseModal: () => void;
  onSelectAction: (action: QuickActionType, item: ProductItem) => void;
  onStockUpdated: () => void;
}

export const InventoryQuickActionController: React.FC<InventoryQuickActionControllerProps> = ({
  state,
  onCloseMenu,
  onCloseModal,
  onSelectAction,
  onStockUpdated,
}) => {
  return (
    <>
      {/* Floating Context Menu */}
      <InventoryItemContextMenu
        isOpen={state.isMenuOpen}
        item={state.selectedItem}
        position={state.position}
        onClose={onCloseMenu}
        onSelectAction={onSelectAction}
      />

      {/* Modal 1: Update Stock Level */}
      <UpdateStockModal
        isOpen={state.activeModal === 'UPDATE_STOCK'}
        item={state.selectedItem}
        onClose={onCloseModal}
        onStockUpdated={onStockUpdated}
      />

      {/* Modal 2: Generate Reorder Request */}
      <GenerateReorderModal
        isOpen={state.activeModal === 'GENERATE_REORDER'}
        item={state.selectedItem}
        suggestedQty={state.suggestedQty}
        onClose={onCloseModal}
        onStockUpdated={onStockUpdated}
      />

      {/* Modal 3: View Audit Trail */}
      <InventoryAuditTrailModal
        isOpen={state.activeModal === 'VIEW_AUDIT'}
        item={state.selectedItem}
        onClose={onCloseModal}
      />
    </>
  );
};
