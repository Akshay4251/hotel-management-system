import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { ordersAPI, tablesAPI } from '../services/api';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [globalOrders, setGlobalOrders] = useState([]);
  const [globalTables, setGlobalTables] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      const [ordersRes, tablesRes] = await Promise.all([
        ordersAPI.getAll(),
        tablesAPI.getAll()
      ]);
      setGlobalOrders(ordersRes.data.data || []);
      setGlobalTables(tablesRes.data.data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  }, []);

  useEffect(() => {
    const SOCKET_URL = 'http://localhost:5000';
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server:', newSocket.id);
      setConnected(true);
      fetchInitialData();
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnected(false);
    });

    // Global updates listeners
    newSocket.on('orders-update', (orders) => {
      console.log('📦 Orders updated:', orders?.length);
      setGlobalOrders(orders || []);
      setLastUpdate(new Date());
    });

    newSocket.on('tables-update', async () => {
      console.log('🪑 Tables update received');
      try {
        const response = await tablesAPI.getAll();
        setGlobalTables(response.data.data || []);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch tables:', error);
      }
    });

    newSocket.on('refresh-data', () => {
      console.log('🔄 Refresh signal received');
      fetchInitialData();
    });

    // Notification events
    newSocket.on('notification', (notification) => {
      setNotifications(prev => [...prev, { ...notification, id: Date.now() }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [fetchInitialData]);

  const value = {
    socket,
    connected,
    globalOrders,
    globalTables,
    lastUpdate,
    notifications,
    refreshData: fetchInitialData,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
      {connected && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg flex items-center gap-2 animate-pulse-soft">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Live 
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};