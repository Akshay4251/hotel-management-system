import React from 'react';

const BillPrint = React.forwardRef(({ bill, order }, ref) => {
  const currentDate = new Date();
  
  return (
    <div ref={ref} id="bill-print-content" style={{ fontFamily: 'monospace' }}>
      <style>
        {`
          @media print {
            body { margin: 0; }
            #bill-print-content { 
              width: 80mm; 
              padding: 5mm;
              font-size: 12px;
            }
            .no-print { display: none !important; }
          }
        `}
      </style>
      
      <div style={{ maxWidth: '300px', margin: '0 auto', padding: '10px', fontSize: '12px', lineHeight: '1.4' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>DELICIOUS RESTAURANT</h2>
          <p style={{ margin: '2px 0', fontSize: '10px' }}>123 Main Street, City Center</p>
          <p style={{ margin: '2px 0', fontSize: '10px' }}>Phone: +91 98765 43210</p>
          <p style={{ margin: '2px 0', fontSize: '10px' }}>GST: 29XXXXX1234X1Z5</p>
        </div>
        
        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
        
        {/* Bill Details */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Bill No:</span>
            <span style={{ fontWeight: 'bold' }}>{bill.billNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Order No:</span>
            <span>{order?.orderNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Table:</span>
            <span>{order?.table?.number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Date:</span>
            <span>{currentDate.toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Time:</span>
            <span>{currentDate.toLocaleTimeString()}</span>
          </div>
        </div>
        
        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
        
        {/* Items Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>
          <span style={{ flex: 2 }}>Item</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Rate</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Amt</span>
        </div>
        
        <div style={{ borderTop: '1px solid #000', marginBottom: '5px' }}></div>
        
        {/* Items */}
        {order?.items?.map((item, index) => (
          <div key={index} style={{ marginBottom: '5px' }}>
            <div style={{ fontSize: '11px', marginBottom: '2px' }}>
              {item.menuItem?.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ flex: 2 }}></span>
              <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>₹{parseFloat(item.price).toFixed(0)}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>₹{parseFloat(item.total).toFixed(0)}</span>
            </div>
          </div>
        ))}
        
        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
        
        {/* Totals */}
        <div style={{ fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Sub Total:</span>
            <span>₹{parseFloat(bill.subtotal).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>CGST (9%):</span>
            <span>₹{(parseFloat(bill.taxAmount) / 2).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>SGST (9%):</span>
            <span>₹{(parseFloat(bill.taxAmount) / 2).toFixed(2)}</span>
          </div>
          {bill.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>Discount:</span>
              <span>-₹{parseFloat(bill.discountAmount).toFixed(2)}</span>
            </div>
          )}
        </div>
        
        {/* Grand Total */}
        <div style={{ borderTop: '1px solid #000', marginTop: '5px', paddingTop: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
            <span>TOTAL:</span>
            <span>₹{parseFloat(bill.totalAmount).toFixed(2)}</span>
          </div>
        </div>
        
        {/* Payment Method */}
        {bill.paymentMethod && (
          <div style={{ marginTop: '10px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Payment Mode:</span>
              <span style={{ textTransform: 'uppercase' }}>{bill.paymentMethod}</span>
            </div>
            {bill.paymentMethod === 'cash' && bill.paidAmount && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid:</span>
                  <span>₹{parseFloat(bill.paidAmount).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Change:</span>
                  <span>₹{parseFloat(bill.changeAmount || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
        
        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '10px' }}>
          <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Thank You! Visit Again</p>
          <p style={{ margin: '2px 0' }}>Powered by Restaurant POS</p>
          <p style={{ margin: '2px 0', fontSize: '9px' }}>This is a computer generated bill</p>
        </div>
        
        {/* Barcode placeholder */}
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div style={{ display: 'inline-block', padding: '5px' }}>
            <svg width="100" height="30">
              {[...Array(25)].map((_, i) => (
                <rect
                  key={i}
                  x={i * 4}
                  y="0"
                  width={i % 2 === 0 ? 3 : 2}
                  height="30"
                  fill="#000"
                />
              ))}
            </svg>
            <div style={{ fontSize: '8px', marginTop: '2px' }}>{bill.billNumber}</div>
          </div>
        </div>
      </div>
    </div>
  );
});

BillPrint.displayName = 'BillPrint';

export default BillPrint;