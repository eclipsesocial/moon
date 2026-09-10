import { ref, set, update, push, get, remove, onValue } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

function requireDb() {
  if (!db) throw new Error('Firebase Realtime Database não está disponível. Verifique a configuração do Firebase.')
}
function requireStorage() {
  if (!storage) throw new Error('Firebase Storage não está disponível. Verifique a configuração do Firebase.')
}
export const now = () => Date.now()

export async function saveUser(uid, data) {
  requireDb(); await update(ref(db, `users/${uid}`), { ...data, updatedAt: now() })
}
export async function saveProfile(uid, data) {
  requireDb(); await update(ref(db, `profiles/${uid}`), { ...data, updatedAt: now() })
}

// Dados privados do cadastro. A senha NUNCA é salva no Realtime Database.
export async function saveAccountData(uid, data) {
  requireDb(); await update(ref(db, `accountData/${uid}`), { ...data, updatedAt: now() })
}
export async function createPost(uid, data) {
  requireDb(); const post = push(ref(db, 'posts'))
  await set(post, { id: post.key, authorId: uid, createdAt: now(), ...data }); return post.key
}
export async function createStatus(uid, data) {
  requireDb(); const status = push(ref(db, 'statuses'))
  await set(status, { id: status.key, authorId: uid, createdAt: now(), ...data }); return status.key
}
export async function createGroup(uid, data) {
  requireDb(); const group = push(ref(db, 'groups'))
  await set(group, { id: group.key, ownerId: uid, createdAt: now(), ...data })
  await set(ref(db, `groupMembers/${group.key}/${uid}`), { role: 'owner', joinedAt: now() }); return group.key
}
export async function addFriend(uid, otherUid) {
  requireDb(); await set(ref(db, `friendRequests/${otherUid}/${uid}`), { from: uid, createdAt: now(), status: 'pending' })
}
export async function blockUser(uid, otherUid) {
  requireDb(); await set(ref(db, `blocks/${uid}/${otherUid}`), { createdAt: now() })
}
export async function sendMessage(chatId, uid, text, mediaUrl='') {
  requireDb(); const msg = push(ref(db, `messages/${chatId}`))
  await set(msg, { id: msg.key, senderId: uid, text, mediaUrl, createdAt: now() }); return msg.key
}
export async function sendNotification(uid, data) {
  requireDb(); const n = push(ref(db, `notifications/${uid}`))
  await set(n, { id: n.key, createdAt: now(), read: false, ...data })
}
export async function uploadMedia(path, file) {
  requireStorage(); const target = storageRef(storage, path)
  await uploadBytes(target, file); return getDownloadURL(target)
}
export async function readNode(path) {
  requireDb(); const snap = await get(ref(db, path)); return snap.exists() ? snap.val() : null
}
export { ref, set, update, push, get, remove, onValue }
