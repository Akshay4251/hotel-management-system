import React from 'react';

const KOTPrint = React.forwardRef(({ order, printTime }, ref) => {
  return (
    <div ref={ref} id="kot-print-content" style={{ fontFamily: 'Courier New, monospace', width: '80mm' }}>
      <div style={{ padding: '10px', fontSize: '14px', lineHeight: '1.3' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
          <h2 style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', letterSpacing: '2px' }}>KOT</h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '11px' }}>KITCHEN ORDER TICKET</p>
        </div>
        
        {/* Order Info */}
        <div style={{ marginBottom: '15px', fontSize: '16px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>TABLE</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', lineHeight: '1' }}>
                {order.table?.number || order.tableNumber}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>ORDER#</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {order.orderNumber}
              </div>
              <div style={{ fontSize: '11px', marginTop: '3px' }}>
                {new Date(printTime || order.createdAt).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Items Header */}
        <div style={{ 
          display: 'flex', 
          borderTop: '2px solid #000',
          borderBottom: '2px solid #000',
          padding: '5px 0',
          fontWeight: 'bold',
          fontSize: '13px'
        }}>
          <div style={{ width: '60px', textAlign: 'center' }}>QTY</div>
          <div style={{ flex: 1 }}>ITEM</div>
        </div>
        
        {/* Items */}
        <div style={{ marginTop: '10px' }}>
          {order.items?.map((item, index) => (
            <div 
              key={index} 
              style={{ 
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: index < order.items.length - 1 ? '1px dashed #ccc' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  width: '60px', 
                  textAlign: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  {item.quantity || 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginBottom: '2px'
                  }}>
                    {item.menuItem?.name || item.name}
                  </div>
                  {item.menuItem?.isVeg !== undefined && (
                    <div style={{ 
                      fontSize: '10px',
                      color: item.menuItem.isVeg ? '#0a8020' : '#d32f2f',
                      fontWeight: 'bold'
                    }}>
                      [{item.menuItem.isVeg ? 'VEG' : 'NON-VEG'}]
                    </div>
                  )}
                  {item.notes && (
                    <div style={{ 
                      fontSize: '12px', 
                      fontStyle: 'italic',
                      marginTop: '4px',
                      color: '#d32f2f',
                      fontWeight: 'bold'
                    }}>
                      ** {item.notes} **
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Special Instructions */}
        {order.notes && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px',
            border: '2px solid #000',
            backgroundColor: '#f0f0f0'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>
              SPECIAL INSTRUCTIONS:
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
              {order.notes}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div style={{ 
          marginTop: '20px', 
          paddingTop: '10px',
          borderTop: '2px solid #000',
          textAlign: 'center',
          fontSize: '11px'
        }}>
          <div style={{ fontWeight: 'bold' }}>
            {new Date().toLocaleString()}
          </div>
          <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: 'bold', letterSpacing: '3px' }}>
            *** END ***
          </div>
        </div>
      </div>
    </div>
  );
});

KOTPrint.displayName = 'KOTPrint';

export default KOTPrint;