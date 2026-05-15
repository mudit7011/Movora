import { Schema, model, Document } from 'mongoose'

export interface IAdmin extends Document {
  email: string
  passwordHash: string
  role: 'superadmin'
}

const adminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['superadmin'], default: 'superadmin' },
  },
  { timestamps: true }
)

export const Admin = model<IAdmin>('Admin', adminSchema)
