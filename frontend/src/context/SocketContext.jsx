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
    // ===== DYNAMIC SOCKET CONFIGURATION =====
    const isDevelopment = import.meta.env.DEV;
    
    // In production: Use same domain
    // In development: Use localhost
    const SOCKET_URL = isDevelopment 
      ? 'http://localhost:5000' 
      : window.location.origin;

    console.log('🔌 Socket Environment:', isDevelopment ? 'Development' : 'Production');
    console.log('🔗 Socket URL:', SOCKET_URL);
    
    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket Connected:', newSocket.id);
      setConnected(true);
      fetchInitialData();
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket Disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket Connection Error:', error.message);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket Reconnected after', attemptNumber, 'attempts');
      fetchInitialData();
    });

    // ===== GLOBAL UPDATE LISTENERS =====
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

    // ===== NOTIFICATION EVENTS =====
    newSocket.on('notification', (notification) => {
      const notificationWithId = { ...notification, id: Date.now() };
      setNotifications(prev => [...prev, notificationWithId]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notificationWithId.id));
      }, 5000);
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Closing socket connection');
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
      
      {/* Live Connection Indicator */}
      {connected && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
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