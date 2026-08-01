import type { InputJsonValue } from "@prisma/client/runtime/client";
import type { Lead } from "@/generated/prisma/client";
import { prisma } from "./db";
import type { ImportCandidate, ImportDb, StoredLead } from "./import-leads";

function toStoredLead(lead: Lead): StoredLead {
  return {
    id: lead.id,
    apolloId: lead.apolloId,
    email: lead.email,
    firstName: lead.firstName,
    lastName: lead.lastName,
    title: lead.title,
    company: lead.company,
    industry: lead.industry,
    location: lead.location,
    phone: lead.phone,
    rawJson: lead.rawJson,
  };
}

function toLeadData(candidate: ImportCandidate) {
  return {
    apolloId: candidate.apolloId ?? null,
    email: candidate.email,
    firstName: candidate.firstName ?? null,
    lastName: candidate.lastName ?? null,
    title: candidate.title ?? null,
    company: candidate.company ?? null,
    industry: candidate.industry ?? null,
    location: candidate.location ?? null,
    phone: candidate.phone ?? null,
    rawJson: candidate.rawJson as InputJsonValue,
  };
}

export const prismaImportDb: ImportDb = {
  async findByEmail(email) {
    const lead = await prisma.lead.findUnique({ where: { email } });
    return lead ? toStoredLead(lead) : null;
  },

  async findByApolloId(apolloId) {
    const lead = await prisma.lead.findUnique({ where: { apolloId } });
    return lead ? toStoredLead(lead) : null;
  },

  async create(data) {
    const lead = await prisma.lead.create({ data: toLeadData(data) });
    return toStoredLead(lead);
  },

  async update(id, data) {
    const lead = await prisma.lead.update({ where: { id }, data: toLeadData(data) });
    return toStoredLead(lead);
  },
};
