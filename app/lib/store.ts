'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  fetchDB,
  createItem,
  updateItem,
  deleteItem,
  todayISO,
  newId,
  type DB,
  type Owner,
  type Pet,
  type WeightEntry,
  type PetPhoto,
  type PetDocument,
  type FamilyMember,
  type EmergencyContact,
  type CommunicationLog,
  type NotificationItem,
  type FeedbackRecord,
  type Appointment,
  type MedRecord,
  type VitalSigns,
  type EMRAttachment,
  type SOAPNotes,
  type MedStock,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type TaxLine,
  type CouponLine,
  type Expense,
  type Staff,
  type ShiftScheduleEntry,
  type AttendanceRecord,
  type LeaveRequest,
  type PayrollRecord,
  type PerformanceReview,
  type StaffDocument,
  type BonusRecord,
  type StaffActivityLog,
  type BoardingPet,
  type FeedingScheduleItem,
  type MedicationScheduleItem,
  type WalkingScheduleItem,
  type HealthCheck,
  type DailyPhoto,
  type CareNote,
  type GroomingAppt,
  type GroomingServiceItem,
  type GroomingProduct,
  type GroomingPhoto,
  type Vaccination,
  type Prescription,
  type PrescriptionItem,
  type Surgery,
  type StaffAssignment,
  type EquipmentItem,
  type AnesthesiaVital,
  type RecoveryVital,
  type LabTest,
  type LabResultParameter,
  type SampleTrackingEntry,
  type LabImage,
  type Supplier,
  type Purchase,
  type PurchaseItem,
  type PharmacySale,
  type SaleItem,
  type Batch,
  type Warehouse,
  type InventoryItem,
  type TransferItem,
  type StockTransfer,
  type StockAdjustment,
  type Campaign,
  type Segment,
  type SegmentRule,
  type SegmentRuleField,
  type SiteMessage,
  type SiteReview,
  type Subscriber,
  type MessageAttachment,
  type Collection,
  type CollectionType as ApiCollectionType,
} from './api';
import { useAuth, type User } from './auth';
import type { Role } from './platform';

export type {
  Owner,
  Pet,
  WeightEntry,
  PetPhoto,
  PetDocument,
  FamilyMember,
  EmergencyContact,
  CommunicationLog,
  NotificationItem,
  FeedbackRecord,
  Appointment,
  MedRecord,
  VitalSigns,
  EMRAttachment,
  SOAPNotes,
  MedStock,
  Invoice,
  InvoiceItem,
  Payment,
  TaxLine,
  CouponLine,
  Expense,
  Staff,
  ShiftScheduleEntry,
  AttendanceRecord,
  LeaveRequest,
  PayrollRecord,
  PerformanceReview,
  StaffDocument,
  BonusRecord,
  StaffActivityLog,
  BoardingPet,
  FeedingScheduleItem,
  MedicationScheduleItem,
  WalkingScheduleItem,
  HealthCheck,
  DailyPhoto,
  CareNote,
  GroomingAppt,
  GroomingServiceItem,
  GroomingProduct,
  GroomingPhoto,
  Vaccination,
  Prescription,
  PrescriptionItem,
  Surgery,
  StaffAssignment,
  EquipmentItem,
  AnesthesiaVital,
  RecoveryVital,
  LabTest,
  LabResultParameter,
  SampleTrackingEntry,
  LabImage,
  Supplier,
  Purchase,
  PurchaseItem,
  PharmacySale,
  SaleItem,
  Batch,
  Warehouse,
  InventoryItem,
  TransferItem,
  StockTransfer,
  StockAdjustment,
  Campaign,
  Segment,
  SegmentRule,
  SegmentRuleField,
  SiteMessage,
  SiteReview,
  Subscriber,
  MessageAttachment,
  DB,
};

export const today = todayISO;
export { newId };

type CollectionType<C extends Collection> = ApiCollectionType<C>;

const emptyDB: DB = {
  owners: [],
  pets: [],
  appointments: [],
  medRecords: [],
  medStock: [],
  invoices: [],
  expenses: [],
  staff: [],
  boarding: [],
  grooming: [],
  vaccinations: [],
  prescriptions: [],
  surgeries: [],
  labTests: [],
  suppliers: [],
  purchases: [],
  pharmacySales: [],
  warehouses: [],
  inventoryItems: [],
  stockTransfers: [],
  stockAdjustments: [],
  campaigns: [],
  segments: [],
  messages: [],
  siteReviews: [],
  subscribers: [],
};

export function useDB() {
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDB()
      .then((data) => {
        if (mounted) setDb(data);
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setDb(emptyDB);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const create = useCallback(
    async <C extends Collection>(
      collection: C,
      item: CollectionType<C>,
    ): Promise<CollectionType<C>> => {
      setDb((prev) => ({
        ...(prev ?? emptyDB),
        [collection]: [...(prev ?? emptyDB)[collection], item],
      }));
      try {
        const created = await createItem(collection, item);
        setDb((prev) => ({
          ...(prev ?? emptyDB),
          [collection]: (prev ?? emptyDB)[collection].map((i) =>
            i.id === item.id ? { ...created, id: created.id } : i,
          ),
        }));
        return created;
      } catch (err) {
        setDb((prev) => ({
          ...(prev ?? emptyDB),
          [collection]: (prev ?? emptyDB)[collection].filter((i) => i.id !== item.id),
        }));
        setError((err as Error).message);
        throw err;
      }
    },
    [],
  );

  const update = useCallback(
    async <C extends Collection>(
      collection: C,
      id: string,
      patch: Partial<CollectionType<C>>,
    ): Promise<void> => {
      // Snapshot the row so a failed request can be rolled back rather than
      // leaving the UI showing a change the database never accepted.
      let previous: CollectionType<C> | undefined;
      setDb((prev) => {
        const base = prev ?? emptyDB;
        previous = base[collection].find((i) => i.id === id) as CollectionType<C> | undefined;
        return {
          ...base,
          [collection]: base[collection].map((i) => (i.id === id ? { ...i, ...patch } : i)),
        };
      });
      try {
        await updateItem(collection, id, patch);
      } catch (err) {
        if (previous) {
          const restored = previous;
          setDb((prev) => ({
            ...(prev ?? emptyDB),
            [collection]: (prev ?? emptyDB)[collection].map((i) => (i.id === id ? restored : i)),
          }));
        }
        setError((err as Error).message);
        throw err;
      }
    },
    [],
  );

  const remove = useCallback(
    async (collection: Collection, id: string): Promise<void> => {
      // Keep the removed row and its position so a failed delete restores it.
      let removed: { item: DB[Collection][number]; index: number } | undefined;
      setDb((prev) => {
        const base = prev ?? emptyDB;
        const index = base[collection].findIndex((i) => i.id === id);
        if (index >= 0) removed = { item: base[collection][index], index };
        return {
          ...base,
          [collection]: base[collection].filter((i) => i.id !== id),
        };
      });
      try {
        await deleteItem(collection, id);
      } catch (err) {
        if (removed) {
          const { item, index } = removed;
          setDb((prev) => {
            const base = prev ?? emptyDB;
            const list = [...base[collection]] as DB[Collection];
            (list as unknown[]).splice(index, 0, item);
            return { ...base, [collection]: list };
          });
        }
        setError((err as Error).message);
        throw err;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDB();
      setDb(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  return { db, error, create, update, remove, refresh };
}

