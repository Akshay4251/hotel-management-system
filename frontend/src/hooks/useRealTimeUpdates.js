import { useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

export const useRealTimeUpdates = (callbacks = {}) => {
  const { socket } = useSocket();

  const setupListeners = useCallback(() => {
    if (!socket) return;

    // Orders updates
    if (callbacks.onOrdersUpdate) {
      socket.on('orders-update', callbacks.onOrdersUpdate);
    }

    // Tables updates
    if (callbacks.onTablesUpdate) {
      socket.on('tables-update', callbacks.onTablesUpdate);
    }

    // New order notification
    if (callbacks.onNewOrder) {
      socket.on('new-order', callbacks.onNewOrder);
    }

    // Order updated
    if (callbacks.onOrderUpdated) {
      socket.on('order-updated', callbacks.onOrderUpdated);
    }

    // Table updated
    if (callbacks.onTableUpdated) {
      socket.on('table-updated', callbacks.onTableUpdated);
    }

    // Bill updates
    if (callbacks.onBillUpdated) {
      socket.on('bill-updated', callbacks.onBillUpdated);
    }

    // Global refresh
    socket.on('refresh-data', () => {
      if (callbacks.onRefresh) {
        callbacks.onRefresh();
      }
    });

    return () => {
      // Cleanup listeners
      socket.off('orders-update');
      socket.off('tables-update');
      socket.off('new-order');
      socket.off('order-updated');
      socket.off('table-updated');
      socket.off('bill-updated');
      socket.off('refresh-data');
    };
  }, [socket, callbacks]);

  useEffect(() => {
    const cleanup = setupListeners();
    return cleanup;
  }, [setupListeners]);
};