import mongoose from 'mongoose';
import { Building, Room, Measurement, Player, Run, RexEvent } from './models.js';

export async function connectDb(uri, dbName) {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 8000 });
  await Promise.all([Building.init(), Room.init(), Measurement.init(), Player.init(), Run.init(), RexEvent.init()]); // builds indexes
  return mongoose.connection;
}

export function dbIsUp() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

// Measurements every summary works from: the last N days, with or without demo data.
export function windowFilter({ windowDays, includeDemo }, extra = {}) {
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  const filter = { createdAt: { $gte: since }, ...extra };
  if (!includeDemo) filter.demo = { $ne: true };
  return filter;
}

export const SUMMARY_FIELDS =
  'roomId buildingId floor carrier score downMbps upMbps latencyMs jitterMs lossPct device hour dow createdAt';
