const { z } = require('zod');

// Every field has an explicit max length. Unbounded text fields are how a
// single request turns into a denial-of-service or a stored-XSS surface.
const schemas = {
  signup: z.object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(200).toLowerCase(),
    password: z.string().min(10).max(200)
      .regex(/[a-z]/, 'Password needs a lowercase letter')
      .regex(/[A-Z]/, 'Password needs an uppercase letter')
      .regex(/[0-9]/, 'Password needs a number'),
  }),
  login: z.object({
    email: z.string().trim().email().max(200).toLowerCase(),
    password: z.string().min(1).max(200),
  }),
  createTeam: z.object({
    name: z.string().trim().min(2).max(60),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, 'Use lowercase letters, numbers, and dashes only.'),
    tagline: z.string().trim().max(140).optional(),
  }),
  updateTeam: z.object({
    name: z.string().trim().min(2).max(60).optional(),
    tagline: z.string().trim().max(140).optional(),
    bio: z.string().trim().max(1000).optional(),
    isPublic: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one team field to update.' }),
  invite: z.object({
    email: z.string().trim().email().max(200).toLowerCase(),
    role: z.enum(['admin', 'member']).default('member'),
  }),
  acceptInvite: z.object({
    token: z.string().min(10).max(200),
  }),
  createPost: z.object({
    tag: z.enum(['Journey', 'Hackathon', 'Milestone', 'Idea']),
    body: z.string().trim().min(1).max(2000),
    linkUrl: z.string().url().max(500).optional().or(z.literal('')),
    visibility: z.enum(['public', 'team']).default('public'),
  }),
  comment: z.object({
    body: z.string().trim().min(1).max(500),
  }),
  createWorkItem: z.object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).optional(),
    status: z.enum(['Launched', 'Research', 'Pending']),
    linkUrl: z.string().url().max(500).optional().or(z.literal('')),
    visibility: z.enum(['public', 'team']).default('public'),
  }),
  updateProfile: z.object({
    fullName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(300).optional(),
  }),
};

function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Unknown validation schema: ${schemaName}`);
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err = new Error(result.error.issues[0]?.message || 'Invalid request.');
      err.status = 422;
      return next(err);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { schemas, validate };
