// backend/socket/socketHandler.js
module.exports = (io) => {
  console.log('🔌 Initializing Socket.IO handler...');

  // Store active connections by role/page
  const connections = {
    customers: new Map(),
    waiters: new Set(),
    kitchen: new Set(),
    admin: new Set()
  };

  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);
    
    // Join room based on user role
    socket.on('join-role', (role) => {
      socket.join(role);
      
      if (role === 'waiter') {
        connections.waiters.add(socket.id);
      } else if (role === 'kitchen') {
        connections.kitchen.add(socket.id);
      } else if (role === 'admin') {
        connections.admin.add(socket.id);
      }
      
      console.log(`👤 Socket ${socket.id} joined ${role} room`);
      socket.emit('role-joined', { role, socketId: socket.id });
    });
    
    // Join table room for customers
    socket.on('join-table', (tableNumber) => {
      const room = `table-${tableNumber}`;
      socket.join(room);
      connections.customers.set(socket.id, tableNumber);
      console.log(`🪑 Socket ${socket.id} joined ${room}`);
      socket.emit('table-joined', { tableNumber, socketId: socket.id });
    });

    // Leave room
    socket.on('leave-room', (room) => {
      socket.leave(room);
      console.log(`🚪 Socket ${socket.id} left room: ${room}`);
    });

    // Handle item status updates from clients (DON'T re-emit, backend will handle)
    socket.on('item-status-updated', (data) => {
      console.log('📤 Item status update received from client:', data);
      // Don't re-emit here, let the API route handle it
    });
    
    // Kitchen notifications
    socket.on('order-ready', (data) => {
      console.log('✅ Order ready notification:', data);
      io.to('waiter').emit('order-ready-notification', data);
      io.to(`table-${data.tableNumber}`).emit('order-ready-notification', data);
    });
    
    // Waiter call
    socket.on('call-waiter', (data) => {
      console.log('🔔 Waiter called for table:', data.tableNumber);
      io.to('waiter').emit('waiter-called', data);
      io.to('admin').emit('waiter-called', data);
    });

    // Handle refresh requests
    socket.on('request-refresh', () => {
      console.log('🔄 Refresh requested by:', socket.id);
      socket.emit('refresh-data'); // Only emit to requesting socket
    });

    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('🔴 Socket error:', socket.id, error);
    });
    
    // Cleanup on disconnect
    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, 'Reason:', reason);
      
      const tableNumber = connections.customers.get(socket.id);
      connections.customers.delete(socket.id);
      connections.waiters.delete(socket.id);
      connections.kitchen.delete(socket.id);
      connections.admin.delete(socket.id);
      
      if (tableNumber) {
        console.log(`🪑 Customer from table ${tableNumber} disconnected`);
      }
    });
  });

  // Heartbeat to keep connections alive (NO DATA REFRESH)
  const heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, 30000);

  process.on('SIGTERM', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('✅ Socket.IO handler initialized successfully');

  // Export helper functions - EMIT ONLY ONE EVENT PER ACTION
  return {
    emitTableUpdate: (table) => {
      console.log('📡 Table update');
      io.emit('table-updated', table);
    },

    emitOrderUpdate: (order) => {
      console.log('📡 Order update:', order?.orderNumber);
      io.emit('order-updated', order);
      
      if (order?.table?.number || order?.tableNumber) {
        const tableNum = order.table?.number || order.tableNumber;
        io.to(`table-${tableNum}`).emit('order-updated', order);
      }
      
      io.to('kitchen').emit('order-updated', order);
    },

    emitNewOrder: (order) => {
      console.log('📡 New order:', order?.orderNumber);
      io.emit('new-order', order);
      io.to('kitchen').emit('print-kot', order);
    },

    emitOrderCancelled: (order) => {
      console.log('📡 Order cancelled:', order?.orderNumber);
      io.emit('order-cancelled', order);
    },

    emitBillUpdate: (bill) => {
      console.log('📡 Bill update');
      io.emit('bill-updated', bill);
    },

    emitItemStatusUpdate: (data) => {
      console.log('📡 Item status update');
      io.emit('item-status-updated', data);
    },

    getConnectionStats: () => {
      return {
        total: io.engine.clientsCount,
        customers: connections.customers.size,
        waiters: connections.waiters.size,
        kitchen: connections.kitchen.size,
        admin: connections.admin.size
      };
    }
  };
};