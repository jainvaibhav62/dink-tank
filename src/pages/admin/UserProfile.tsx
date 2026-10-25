import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { useAuth } from '../../context/AuthContext'
import { fetchUserProfile, updateUserProfile } from '../../services/auth'
import type { PlayingHand, Role, SkillLevel, UserProfile } from '../../types'

export function AdminUserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { profile: me } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roleSaving, setRoleSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner')
  const [gender, setGender] = useState('')
  const [playingHand, setPlayingHand] = useState<PlayingHand>('right')

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadProfile() {
    if (!userId) return
    setLoading(true)
    try {
      const user = await fetchUserProfile(userId)
      if (user) {
        setProfile(user)
        setDisplayName(user.displayName)
        setSkillLevel(user.skillLevel)
        setGender(user.gender)
        setPlayingHand(user.playingHand)
      }
    } catch (err) {
      console.error('Failed to load user:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      await updateUserProfile(profile.uid, { displayName, skillLevel, gender, playingHand })
      setProfile({ ...profile, displayName, skillLevel, gender, playingHand })
      setEditing(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRole() {
    if (!profile) return
    const nextRole: Role = profile.role === 'admin' ? 'player' : 'admin'
    if (!window.confirm(`${nextRole === 'admin' ? 'Promote' : 'Demote'} ${profile.displayName} ${nextRole === 'admin' ? 'to admin' : 'to player'}?`)) {
      return
    }
    setRoleSaving(true)
    try {
      await updateUserProfile(profile.uid, { role: nextRole })
      setProfile({ ...profile, role: nextRole })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change role')
    } finally {
      setRoleSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading…</p>
  if (!profile) return <p className="text-slate-500 dark:text-slate-400">User not found.</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.displayName}</h1>
        <button
          onClick={() => navigate('/admin/users')}
          className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Back
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-4">
          <Avatar src={profile.photoURL} name={profile.displayName} size={64} />
          <div className="flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{profile.email}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">ID</p>
            <p className="font-mono text-sm text-slate-600 dark:text-slate-400">{profile.uid}</p>
          </div>
        </div>

        {!editing ? (
          <div className="space-y-4">
            <Field label="Display name" value={profile.displayName} />
            <Field label="Skill level" value={profile.skillLevel} capitalize />
            <Field label="Gender" value={profile.gender || '—'} />
            <Field label="Playing hand" value={profile.playingHand} capitalize />
            <Field label="Role" value={profile.role} capitalize />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Edit profile
              </button>
              {profile.uid !== me?.uid && (
                <button
                  onClick={handleToggleRole}
                  disabled={roleSaving}
                  className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {roleSaving ? 'Saving…' : profile.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Skill level</span>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Gender</span>
              <input
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Playing hand</span>
              <select
                value={playingHand}
                onChange={(e) => setPlayingHand(e.target.value as PlayingHand)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <p className={`text-slate-900 dark:text-slate-100 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  )
}
