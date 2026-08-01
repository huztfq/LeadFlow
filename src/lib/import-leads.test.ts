import { describe, expect, it } from "vitest";
import {
  type ImportCandidate,
  type ImportDb,
  type StoredLead,
  importCandidates,
  normalizeApolloPerson,
} from "./import-leads";

function createFakeDb(initial: StoredLead[] = []) {
  const leads = [...initial];
  let nextId = 1;

  const db: ImportDb = {
    async findByEmail(email) {
      return leads.find((l) => l.email === email) ?? null;
    },
    async findByApolloId(apolloId) {
      return leads.find((l) => l.apolloId === apolloId) ?? null;
    },
    async create(data) {
      const lead: StoredLead = {
        id: `lead-${nextId++}`,
        apolloId: data.apolloId ?? null,
        email: data.email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        title: data.title ?? null,
        company: data.company ?? null,
        industry: data.industry ?? null,
        location: data.location ?? null,
        phone: data.phone ?? null,
        rawJson: data.rawJson,
      };
      leads.push(lead);
      return lead;
    },
    async update(id, data) {
      const idx = leads.findIndex((l) => l.id === id);
      if (idx === -1) throw new Error("not found");
      leads[idx] = {
        ...leads[idx],
        apolloId: data.apolloId ?? null,
        email: data.email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        title: data.title ?? null,
        company: data.company ?? null,
        industry: data.industry ?? null,
        location: data.location ?? null,
        phone: data.phone ?? null,
        rawJson: data.rawJson,
      };
      return leads[idx];
    },
  };

  return { db, leads };
}

describe("normalizeApolloPerson", () => {
  it("maps Apollo fields to ImportCandidate", () => {
    const person = {
      id: "apollo-1",
      email: "Ada@Example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      title: "Engineer",
      organization: { name: "Analytical Engines", industry: "Tech" },
      city: "London",
      state: null,
      country: "UK",
      phone_numbers: [{ raw_number: "+44 20 7946 0958" }],
    };

    const candidate = normalizeApolloPerson(person);
    expect(candidate).toEqual({
      apolloId: "apollo-1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      company: "Analytical Engines",
      industry: "Tech",
      location: "London, UK",
      phone: "+44 20 7946 0958",
      rawJson: person,
    });
  });

  it("uses top-level industry when organization industry is absent", () => {
    const person = {
      id: "apollo-2",
      email: "test@example.com",
      industry: "Healthcare",
      organization: { name: "Clinic" },
    };

    expect(normalizeApolloPerson(person)?.industry).toBe("Healthcare");
  });

  it("returns null when no email", () => {
    expect(normalizeApolloPerson({ id: "x", first_name: "No" })).toBeNull();
    expect(normalizeApolloPerson({ id: "x", email: "" })).toBeNull();
    expect(normalizeApolloPerson({ id: "x", email: "   " })).toBeNull();
  });
});

describe("importCandidates", () => {
  const base: ImportCandidate = {
    apolloId: "apollo-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    company: "Analytical Engines",
    industry: "Tech",
    location: "London, UK",
    phone: null,
    rawJson: { id: "apollo-1" },
  };

  it("creates a new lead when none exists", async () => {
    const { db } = createFakeDb();
    const summary = await importCandidates([base], db);
    expect(summary).toEqual({
      imported: 1,
      updated: 0,
      skippedNoEmail: 0,
      failed: 0,
    });
  });

  it("updates existing lead matched by email and persists fields", async () => {
    const { db, leads } = createFakeDb([
      {
        id: "existing-1",
        apolloId: "apollo-1",
        email: "ada@example.com",
        firstName: "Old",
        lastName: "Name",
        title: null,
        company: null,
        industry: null,
        location: null,
        phone: null,
        rawJson: {},
      },
    ]);

    const summary = await importCandidates([base], db);
    expect(summary).toEqual({
      imported: 0,
      updated: 1,
      skippedNoEmail: 0,
      failed: 0,
    });
    expect(leads[0]).toMatchObject({
      id: "existing-1",
      apolloId: "apollo-1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      company: "Analytical Engines",
      industry: "Tech",
      location: "London, UK",
      rawJson: { id: "apollo-1" },
    });
  });

  it("updates existing lead matched by apolloId and persists fields", async () => {
    const updated = { ...base, email: "new@example.com" };
    const { db, leads } = createFakeDb([
      {
        id: "existing-1",
        apolloId: "apollo-1",
        email: "old@example.com",
        firstName: "Old",
        lastName: "Name",
        title: null,
        company: null,
        industry: null,
        location: null,
        phone: null,
        rawJson: {},
      },
    ]);

    const summary = await importCandidates([updated], db);
    expect(summary).toEqual({
      imported: 0,
      updated: 1,
      skippedNoEmail: 0,
      failed: 0,
    });
    expect(leads[0]).toMatchObject({
      id: "existing-1",
      apolloId: "apollo-1",
      email: "new@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      company: "Analytical Engines",
      industry: "Tech",
      location: "London, UK",
      rawJson: { id: "apollo-1" },
    });
  });

  it("prefers email match over apolloId match", async () => {
    const { db } = createFakeDb([
      {
        id: "by-email",
        apolloId: "other-apollo",
        email: "ada@example.com",
        firstName: "Email",
        lastName: "Match",
        title: null,
        company: null,
        industry: null,
        location: null,
        phone: null,
        rawJson: {},
      },
      {
        id: "by-apollo",
        apolloId: "apollo-1",
        email: "other@example.com",
        firstName: "Apollo",
        lastName: "Match",
        title: null,
        company: null,
        industry: null,
        location: null,
        phone: null,
        rawJson: {},
      },
    ]);

    const summary = await importCandidates([base], db);
    expect(summary.updated).toBe(1);
    expect(summary.imported).toBe(0);
  });

  it("counts failed when create throws", async () => {
    const db: ImportDb = {
      findByEmail: async () => null,
      findByApolloId: async () => null,
      create: async () => {
        throw new Error("db error");
      },
      update: async () => {
        throw new Error("should not update");
      },
    };

    const summary = await importCandidates([base], db);
    expect(summary.failed).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.updated).toBe(0);
  });

  it("counts failed when update throws", async () => {
    const db: ImportDb = {
      findByEmail: async () => ({
        id: "existing-1",
        apolloId: "apollo-1",
        email: "ada@example.com",
        firstName: "Old",
        lastName: "Name",
        title: null,
        company: null,
        industry: null,
        location: null,
        phone: null,
        rawJson: {},
      }),
      findByApolloId: async () => null,
      create: async () => {
        throw new Error("should not create");
      },
      update: async () => {
        throw new Error("db error");
      },
    };

    const summary = await importCandidates([base], db);
    expect(summary.failed).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.updated).toBe(0);
  });
});
