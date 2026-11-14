const mongoose = require('mongoose');

// Counts are computed client-side from loaded data, so they are never stored.
const SegmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    rules: [
      {
        field: {
          type: String,
          enum: ['loyaltyPoints', 'totalSpent', 'visitCount', 'daysSinceLastVisit', 'petAgeYears', 'petSpecies', 'vaccinationDue'],
          default: 'loyaltyPoints',
        },
        op: { type: String, enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'], default: 'gte' },
        value: { type: String, default: '' },
      },
    ],
    match: { type: String, enum: ['all', 'any'], default: 'all' },
    createdBy: { type: String, default: '' },
    createdAt: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Segment', SegmentSchema);
