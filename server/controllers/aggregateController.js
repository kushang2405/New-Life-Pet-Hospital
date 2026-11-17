const asyncHandler = require('../middleware/asyncHandler');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');
const MedRecord = require('../models/MedRecord');
const MedStock = require('../models/MedStock');
const Invoice = require('../models/Invoice');
const Staff = require('../models/Staff');
const Boarding = require('../models/Boarding');
const Grooming = require('../models/Grooming');
const Vaccination = require('../models/Vaccination');
const Prescription = require('../models/Prescription');
const Surgery = require('../models/Surgery');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const PharmacySale = require('../models/PharmacySale');
const Warehouse = require('../models/Warehouse');
const InventoryItem = require('../models/InventoryItem');
const StockTransfer = require('../models/StockTransfer');
const StockAdjustment = require('../models/StockAdjustment');
const Expense = require('../models/Expense');
const Campaign = require('../models/Campaign');
const Segment = require('../models/Segment');
const Message = require('../models/Message');
const SiteReview = require('../models/SiteReview');
const Subscriber = require('../models/Subscriber');
const DiagnosticReport = require('../models/DiagnosticReport');
const Certificate = require('../models/Certificate');

const mapId = (d) => ({ ...d, id: d._id.toString() });
const stripStaffSecrets = ({ password, resetToken, resetTokenExpiry, ...rest }) => mapId(rest);

const aggregate = asyncHandler(async (req, res) => {
  const isStaff = req.user && req.user.role === 'Staff';

  const [
    owners,
    pets,
    appointments,
    medRecords,
    medStock,
    invoices,
    expenses,
    staff,
    boarding,
    grooming,
    vaccinations,
    prescriptions,
    surgeries,
    suppliers,
    purchases,
    pharmacySales,
    warehouses,
    inventoryItems,
    stockTransfers,
    stockAdjustments,
    campaigns,
    segments,
    messages,
    siteReviews,
    subscribers,
    reports,
    certificates,
  ] = await Promise.all([
    isStaff ? [] : Owner.find().lean(),
    isStaff ? [] : Pet.find().lean(),
    Appointment.find().lean(),
    isStaff ? [] : MedRecord.find().lean(),
    isStaff ? [] : MedStock.find().lean(),
    isStaff ? [] : Invoice.find().lean(),
    isStaff ? [] : Expense.find().lean(),
    Staff.find().lean(),
    isStaff ? [] : Boarding.find().lean(),
    isStaff ? [] : Grooming.find().lean(),
    isStaff ? [] : Vaccination.find().lean(),
    isStaff ? [] : Prescription.find().lean(),
    isStaff ? [] : Surgery.find().lean(),
    isStaff ? [] : Supplier.find().lean(),
    isStaff ? [] : Purchase.find().lean(),
    isStaff ? [] : PharmacySale.find().lean(),
    isStaff ? [] : Warehouse.find().lean(),
    isStaff ? [] : InventoryItem.find().lean(),
    isStaff ? [] : StockTransfer.find().lean(),
    isStaff ? [] : StockAdjustment.find().lean(),
    isStaff ? [] : Campaign.find().lean(),
    isStaff ? [] : Segment.find().lean(),
    isStaff ? [] : Message.find().lean(),
    isStaff ? [] : SiteReview.find().lean(),
    isStaff ? [] : Subscriber.find().lean(),
    isStaff ? [] : DiagnosticReport.find({}, { pdfData: 0 }).sort({ createdAt: -1 }).lean(),
    isStaff ? [] : Certificate.find({}, { pdfData: 0 }).sort({ createdAt: -1 }).lean(),
  ]);

  res.json({
    owners: owners.map(mapId),
    pets: pets.map(mapId),
    appointments: appointments.map(mapId),
    medRecords: medRecords.map(mapId),
    medStock: medStock.map(mapId),
    invoices: invoices.map(mapId),
    expenses: expenses.map(mapId),
    staff: staff.map(stripStaffSecrets),
    boarding: boarding.map(mapId),
    grooming: grooming.map(mapId),
    vaccinations: vaccinations.map(mapId),
    prescriptions: prescriptions.map(mapId),
    surgeries: surgeries.map(mapId),
    suppliers: suppliers.map(mapId),
    purchases: purchases.map(mapId),
    pharmacySales: pharmacySales.map(mapId),
    warehouses: warehouses.map(mapId),
    inventoryItems: inventoryItems.map(mapId),
    stockTransfers: stockTransfers.map(mapId),
    stockAdjustments: stockAdjustments.map(mapId),
    campaigns: campaigns.map(mapId),
    segments: segments.map(mapId),
    messages: messages.map(mapId),
    siteReviews: siteReviews.map(mapId),
    subscribers: subscribers.map(mapId),
    reports: reports.map(mapId),
    certificates: certificates.map(mapId),
  });
});

module.exports = { aggregate };
