// A tiny in-memory stand-in for the Mongoose models, so the game's logic can be checked without a database.
// It supports only what service.js uses: equality, $ne, $gte, $in filters; sort; limit; lean.
let counter = 0;

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ('$ne' in cond && v === cond.$ne) return false;
      if ('$gte' in cond && !(v >= cond.$gte)) return false;
      if ('$in' in cond && !cond.$in.includes(v)) return false;
      return true;
    }
    return v === cond;
  });
}

class Query {
  constructor(rows) { this.rows = rows; this.limitN = Infinity; }
  sort(spec) {
    const [[k, dir]] = Object.entries(spec);
    this.rows = [...this.rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir);
    return this;
  }
  limit(n) { this.limitN = n; return this; }
  select() { return this; }
  lean() { return this; }
  then(res, rej) { return Promise.resolve(this.rows.slice(0, this.limitN).map((r) => structuredClone(r))).then(res, rej); }
}

export class FakeModel {
  constructor(uniques = []) { this.docs = []; this.uniques = uniques; }
  find(filter) { return new Query(this.docs.filter((d) => matches(d, filter))); }
  findOne(filter) { const q = this.find(filter); const t = q.then.bind(q); return { lean: () => ({ then: (a, b) => t((rows) => rows[0] || null).then(a, b) }), then: (a, b) => t((rows) => rows[0] || null).then(a, b) }; }
  findById(id) { return this.findOne({ _id: id }); }
  async create(data) {
    for (const u of this.uniques) {
      if (this.docs.some((d) => d[u] === data[u])) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
    }
    const doc = structuredClone({ _id: data._id ?? `fake${++counter}`, ...data });
    this.docs.push(doc);
    return { ...structuredClone(doc), toObject() { return structuredClone(doc); } };
  }
  async updateOne(filter, update) {
    const d = this.docs.find((x) => matches(x, filter));
    if (d && update.$set) {
      for (const [k, v] of Object.entries(update.$set)) d[k] = structuredClone(v);
    }
    return { matchedCount: d ? 1 : 0 };
  }
  async countDocuments(filter) { return this.docs.filter((d) => matches(d, filter)).length; }
}

export function fakeModels() {
  return {
    Player: new FakeModel(['device', 'nickLower']),
    Run: new FakeModel(),
    RexEvent: new FakeModel(),
    Measurement: new FakeModel(),
    Room: new FakeModel(),
  };
}
