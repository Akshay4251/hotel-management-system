const express = require('express');
const router = express.Router();
const { Table, Order } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');

// ✅ UPDATED: Build customer link (can be overridden by query param)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const customerLinkForTable = (tableNumber, customUrl = null) => {
  if (customUrl) return customUrl;
  return `${FRONTEND_URL}/menu/${encodeURIComponent(tableNumber)}?src=qr`;
};

// Get all tables
router.get('/', async (req, res) => {
  try {
    const tables = await Table.findAll({
      include: [{
        model: Order,
        as: 'orders',
        where: { status: { [Op.ne]: 'completed' } },
        required: false
      }],
      order: [['number', 'ASC']]
    });
    res.json({ success: true, data: tables });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single table by ID
router.get('/:id', async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id, {
      include: [{
        model: Order,
        as: 'orders',
        where: { status: { [Op.ne]: 'completed' } },
        required: false
      }]
    });
    
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    res.json({ success: true, data: table });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify table
router.post('/verify', async (req, res) => {
  try {
    const { tableNumber } = req.body;
    const table = await Table.findOne({ where: { number: tableNumber } });
    
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    res.json({ success: true, data: table });
  } catch (error) {
    console.error('Verify table error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update table status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    table.status = status;
    await table.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('table-updated', table);
    }

    res.json({ success: true, data: table });
  } catch (error) {
    console.error('Update table status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create table
router.post('/', async (req, res) => {
  try {
    const table = await Table.create(req.body);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('table-created', table);
    }
    
    res.status(201).json({ success: true, data: table });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update table
router.put('/:id', async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id);
    
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    await table.update(req.body);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('table-updated', table);
    }
    
    res.json({ success: true, data: table });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete table
router.delete('/:id', async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id);
    
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    await table.destroy();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('table-deleted', { id: req.params.id });
    }
    
    res.json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ✅ UPDATED: Print page with all table QR codes
 * GET /api/tables/qr/print?size=260&url=https://yourdomain.com
 */
router.get('/qr/print', async (req, res) => {
  try {
    const { size = 260, url: baseUrl } = req.query;
    const tables = await Table.findAll({ order: [['number', 'ASC']] });

    const publicUrl = baseUrl || FRONTEND_URL;
    console.log('📄 Generating print page with base URL:', publicUrl);

    // Generate QR codes as data URLs for embedding in HTML
    const tableQRs = await Promise.all(
      tables.map(async (t) => {
        const link = `${publicUrl}/menu/${encodeURIComponent(t.number)}?src=qr`;
        const qrDataUrl = await QRCode.toDataURL(link, {
          width: parseInt(size, 10) || 260,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        return { number: t.number, qrDataUrl, link };
      })
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Table QR Codes - Print</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            color: #111; 
            padding: 20px;
          }
          .header { 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            margin-bottom: 20px; 
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }
          .brand { 
            font-size: 20px; 
            font-weight: bold; 
          }
          .info { 
            font-size: 12px; 
            color: #666; 
          }
          .print-btn { 
            display: inline-block; 
            padding: 8px 16px; 
            border: 2px solid #444; 
            border-radius: 6px; 
            text-decoration: none; 
            color: #111; 
            font-weight: bold;
            cursor: pointer;
            background: #f0f0f0;
          }
          .print-btn:hover {
            background: #e0e0e0;
          }
          .grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px; 
            margin-top: 20px;
          }
          .card { 
            border: 2px solid #ddd; 
            border-radius: 10px; 
            padding: 16px; 
            text-align: center;
            page-break-inside: avoid;
            background: white;
          }
          .card-title { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 12px;
            color: #333;
          }
          .qr-container {
            background: #f9f9f9;
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
          }
          .qr-container img { 
            width: 100%; 
            max-width: ${size}px; 
            height: auto;
            display: block;
            margin: 0 auto;
          }
          .link { 
            font-size: 10px; 
            color: #666; 
            margin-top: 8px; 
            word-break: break-all;
            line-height: 1.4;
          }
          @media print { 
            .no-print { display: none !important; } 
            body { padding: 0; }
            .grid { gap: 15px; }
          }
          @media screen and (max-width: 768px) {
            .grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media screen and (max-width: 480px) {
            .grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="header no-print">
          <div>
            <div class="brand">🍽️ Table QR Codes</div>
            <div class="info">${tables.length} tables • ${publicUrl}</div>
          </div>
          <button onclick="window.print()" class="print-btn">
            🖨️ Print All QR Codes
          </button>
        </div>
        
        <div class="grid">
          ${tableQRs.map(t => `
            <div class="card">
              <div class="card-title">Table ${t.number}</div>
              <div class="qr-container">
                <img src="${t.qrDataUrl}" alt="Table ${t.number} QR Code" />
              </div>
              <div class="link">${t.link}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `.trim();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // ✅ NO CACHE for print page
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(html);
  } catch (error) {
    console.error('❌ QR print page failed:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>Failed to generate QR print page</h1>
        <p>${error.message}</p>
      </body>
      </html>
    `);
  }
});

/**
 * ✅ UPDATED: Generate QR PNG for a specific table
 * GET /api/tables/:number/qr?size=280&download=1&url=https://yourdomain.com/menu/1
 */
router.get('/:number/qr', async (req, res) => {
  try {
    const { number } = req.params;
    const { size = 280, download, url: customUrl } = req.query;

    const table = await Table.findOne({ where: { number } });
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: `Table ${number} not found` 
      });
    }

    // ✅ Use custom URL from query param or build default
    const link = customUrl || customerLinkForTable(table.number);
    console.log(`🔗 Generating QR for Table ${number}:`, link);

    const qrSize = parseInt(size, 10) || 280;
    
    const opts = { 
      width: qrSize,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };

    // ✅ Set CORS headers
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // ✅ Set content headers with NO CACHE
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="table-${table.number}-qr.png"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="table-${table.number}-qr.png"`);
    }

    // ✅ Generate and stream QR code
    const buffer = await QRCode.toBuffer(link, opts);
    res.send(buffer);

  } catch (error) {
    console.error('❌ QR generation failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate QR code',
      error: error.message 
    });
  }
});

module.exports = router;