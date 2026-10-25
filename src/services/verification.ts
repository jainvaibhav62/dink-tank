import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

export async function sendVerificationCode(email: string, uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'sendVerificationCode')
  await fn({ email, uid })
}

export async function verifyCode(uid: string, code: string): Promise<void> {
  const fn = httpsCallable(functions, 'verifyCode')
  await fn({ uid, code })
}

export async function deleteUserAccount(uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'deleteUser')
  await fn({ uid })
}
