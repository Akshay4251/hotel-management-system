import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, CheckCircle, ChefHat, Bell, RefreshCw, Printer, Settings } from 'lucide-react';
import { ordersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import KOTPrint from '../components/KOTPrint';

function KOT() {
  const { socket, globalOrders, refreshData } = useSocket();
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printMethod, setPrintMethod] = useState('silent');
  const [showSettings, setShowSettings] = useState(false);
  const kotPrintRef = useRef();
  const printTimeoutRef = useRef();
  const hasPrintedRef = useRef(new Set());
  const printIframeRef = useRef(null);

  useEffect(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'kot-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    printIframeRef.current = iframe;

    return () => {
      if (printIframeRef.current) {
        document.body.removeChild(printIframeRef.current);
      }
    };
  }, []);

  const handleAutoPrintKOT = useCallback(async (order) => {
    if (hasPrintedRef.current.has(order.id)) {
      return;
    }
    
    hasPrintedRef.current.add(order.id);
    
    // Refresh data to show the new order immediately
    await refreshData();
    
    setSelectedOrderForPrint(order);
    setShowPrintPreview(true);
    
    setTimeout(() => {
      if (printMethod === 'server') {
        triggerServerPrint(order);
      } else {
        triggerSilentPrint(order);
      }
    }, 500);
    
    printTimeoutRef.current = setTimeout(() => {
      setShowPrintPreview(false);
      setSelectedOrderForPrint(null);
    }, 2000);
  }, [printMethod, refreshData]);

  useEffect(() => {
    if (socket) {
      socket.emit('join-role', 'kitchen');
      
      // Handle print KOT event
      socket.on('print-kot', async (data) => {
        await refreshData();
        handleAutoPrintKOT(data);
      });

      // Handle new order event
      socket.on('new-order', async (order) => {
        await refreshData();
        handleAutoPrintKOT(order);
      });

      // Listen for order updates
      socket.on('order-updated', async () => {
        await refreshData();
      });

      // Listen for item status updates
      socket.on('item-status-updated', async () => {
        await refreshData();
      });

      // Listen for any order changes
      socket.on('order-status-changed', async () => {
        await refreshData();
      });
    }
    
    return () => {
      if (socket) {
        socket.off('print-kot');
        socket.off('new-order');
        socket.off('order-updated');
        socket.off('item-status-updated');
        socket.off('order-status-changed');
      }
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
      }
    };
  }, [socket, refreshData, handleAutoPrintKOT]);

  useRealTimeUpdates({
    onNewOrder: async (order) => {
      await refreshData();
      handleAutoPrintKOT(order);
    },
    onOrderUpdated: async () => {
      await refreshData();
    },
    onRefresh: async () => {
      await refreshData();
    }
  });

  const triggerSilentPrint = (order) => {
    const printContent = document.getElementById('kot-print-content');
    if (!printContent) return;

    const iframe = printIframeRef.current;
    if (!iframe) return;
    
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>KOT - Table ${order.table?.number || order.tableNumber}</title>
            <meta charset="UTF-8">
            <style>
              @page { size: 80mm auto; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { margin: 0; padding: 0; font-family: 'Courier New', monospace; width: 80mm; }
              @media print { body { margin: 0; padding: 0; } @page { margin: 0; } }
            </style>
          </head>
          <body>${printContent.innerHTML}</body>
        </html>
      `);
      iframeDoc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (printError) {
            console.error('Print error:', printError);
          }
        }, 100);
      };
      
    } catch (error) {
      console.error('Error preparing print:', error);
    }
  };

  const triggerServerPrint = async (order) => {
    try {
      const backendURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${backendURL}/api/print/kot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderData: {
            tableNumber: order.table?.number || order.tableNumber,
            orderNumber: order.orderNumber,
            items: order.items?.map(item => ({
              quantity: item.quantity,
              name: item.menuItem?.name || item.name,
              notes: item.notes,
              isVeg: item.menuItem?.isVeg
            }))
          }
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Print failed');
      }
    } catch (error) {
      triggerSilentPrint(order);
    }
  };

  const markAsReady = async (orderId, itemId) => {
    try {
      await ordersAPI.updateItemStatus(orderId, itemId, 'served');
      await refreshData();
      toast.success('Item marked as ready');
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update');
    }
  };

  const handleManualPrint = (order) => {
    setSelectedOrderForPrint(order);
    setShowPrintPreview(true);
    
    setTimeout(() => {
      triggerSilentPrint(order);
    }, 500);
    
    printTimeoutRef.current = setTimeout(() => {
      setShowPrintPreview(false);
      setSelectedOrderForPrint(null);
    }, 2000);
  };

  const activeOrders = globalOrders.filter(
    o => o.status !== 'completed' && o.status !== 'cancelled'
  );

  const pendingItems = activeOrders.reduce((count, order) => {
    return count + (order.items || []).filter(item => item.status === 'pending').length;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ display: 'none' }}>
        {selectedOrderForPrint && (
          <KOTPrint ref={kotPrintRef} order={selectedOrderForPrint} printTime={new Date()} />
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Print Settings</h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Print Method</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="printMethod"
                      value="silent"
                      checked={printMethod === 'silent'}
                      onChange={(e) => setPrintMethod(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Browser Print</div>
                      <div className="text-sm text-gray-600">Use browser print dialog</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="printMethod"
                      value="server"
                      checked={printMethod === 'server'}
                      onChange={(e) => setPrintMethod(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Print Server</div>
                      <div className="text-sm text-gray-600">Direct thermal printing</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Notification */}
      {showPrintPreview && selectedOrderForPrint && (
        <div className="fixed top-4 right-4 z-50 animate-slide-down">
          <div className="bg-white rounded-lg shadow-xl border-2 border-green-500 p-4 min-w-[280px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Printing KOT</h3>
                <p className="text-sm text-gray-600">
                  Table {selectedOrderForPrint.table?.number || selectedOrderForPrint.tableNumber}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kitchen</h1>
                <p className="text-xs text-gray-600 hidden sm:block">Auto-print enabled</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={refreshData} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-gray-100 rounded-lg">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{activeOrders.length}</p>
                  <p className="text-xs text-gray-600">Active</p>
                </div>
                <div className="w-px h-10 bg-gray-300"></div>
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-600">{pendingItems}</p>
                  <p className="text-xs text-gray-600">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Orders Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeOrders.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {activeOrders.map(order => {
              const allServed = order.items?.every(item => item.status === 'served');
              return (
                <div 
                  key={order.id} 
                  className={`bg-white rounded-xl overflow-hidden border-2 ${
                    allServed ? 'border-green-500' : 'border-orange-400'
                  }`}
                >
                  <div className={`p-4 text-white ${allServed ? 'bg-green-600' : 'bg-gray-900'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold">Table {order.table?.number}</h3>
                        <p className="text-sm opacity-90">#{order.orderNumber}</p>
                      </div>
                      <button
                        onClick={() => handleManualPrint(order)}
                        className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs mt-2 opacity-75 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {order.items?.map((item, index) => (
                      <div 
                        key={item.id || index}
                        className={`p-3 rounded-lg border-2 ${
                          item.status === 'served' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-orange-50 border-orange-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xl font-bold text-gray-900 bg-white px-3 py-1 rounded-lg flex-shrink-0">
                              {item.quantity}×
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">
                                {item.menuItem?.name}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-red-600 mt-1 truncate">
                                  ⚠️ {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {item.status === 'pending' ? (
                            <button 
                              onClick={() => markAsReady(order.id, item.id)}
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex-shrink-0"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium flex-shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {allServed && (
                      <div className="pt-2 border-t text-center">
                        <span className="px-4 py-2 bg-green-100 text-green-700 text-sm rounded-full font-medium inline-block">
                          ✓ All Ready
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default KOT;