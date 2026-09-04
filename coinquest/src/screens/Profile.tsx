import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { Person, Pose } from '../../shared/types'
import { AVATAR_COLORS, api } from '../lib/api'
import { useSession } from '../lib/session'
import { Hero } from '../components/Hero'
import { PhotoInput, type UploadedPhoto } from '../components/PhotoInput'
import { HERO_POSE, Mascot, POSES } from '../components/Mascot'
import {
  Avatar,
  Button,
  Card,
  ColorPicker,
  Eyebrow,
  FIELD_CLASS,
  Field,
  Screen,
  ScreenMessage,
  SmallButton,
  Spinner,
  TextField,
  cx,
} from '../components/ui'

const POSE_KEYS = Object.keys(POSES) as Pose[]

/**
 * Profile editing. A kid may edit their own profile; a parent may edit anyone
 * in the family, and only a parent can set or clear a PIN. The server enforces
 * all three — this screen just reflects them.
 */
export function Profile() {
  const personId = Number(useParams().personId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parent } = useSession()

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => api.person(personId),
  })

  // A kid reaching their own profile from their home screen acts as themselves.
  const actorId = parent?.id ?? personId
  const canEditPin = Boolean(parent) && data?.role === 'parent'

  const [draft, setDraft] = useState<Partial<Person> | null>(null)
  const [avatarPhoto, setAvatarPhoto] = useState<UploadedPhoto | null | 'keep'>('keep')
  const [pin, setPin] = useState('')
  const [saved, setSaved] = useState(false)
  const [error2, setError2] = useState<string | null>(null)

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      api.updateProfile(personId, {
        actorId,
        name: draft?.name,
        nickname: draft?.nickname ?? null,
        about: draft?.about ?? null,
        age: draft?.age ?? null,
        avatarColor: draft?.avatarColor,
        // 'keep' means untouched this session; anything else moves the photo.
        ...(avatarPhoto === 'keep' ? {} : { avatarMediaId: avatarPhoto?.id ?? null }),
        mascotPose: draft?.mascotPose ?? null,
        ...(canEditPin && pin ? { pin } : {}),
      }),
    onError: (err: Error) => setError2(err.message),
    onSuccess: (person) => {
      setError2(null)
      setSaved(true)
      setPin('')
      queryClient.setQueryData(['person', personId], person)
      queryClient.invalidateQueries({ queryKey: ['family'] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.invalidateQueries({ queryKey: ['kidHome', personId] })
    },
  })

  const backTo = parent ? '/parent/admin' : `/kid/${personId}`
  const pose = draft?.mascotPose ?? HERO_POSE.profile

  return (
    <Screen
      hero={
        <Hero
          eyebrow={data?.role === 'parent' ? 'Parent' : 'Kid'}
          title={draft?.nickname || draft?.name || 'Profile'}
          subtitle="Make it yours."
          pose={pose}
          back={backTo}
        />
      }
    >
      {isPending && <Spinner />}
      {isError && <ScreenMessage>{(error as Error).message}</ScreenMessage>}

      {draft && (
        <div className="scroll-y animate-fade -mx-1 flex flex-1 flex-col gap-4 px-6 pt-4 pb-6 [&>*]:shrink-0">
          <Card className="flex items-center gap-4 p-4">
            <Avatar
              initial={(draft.nickname || draft.name || '?').charAt(0)}
              color={draft.avatarColor!}
              image={avatarPhoto === 'keep' ? draft.avatarUrl : (avatarPhoto?.thumbUrl ?? null)}
              size={56}
            />
            <div className="flex flex-col gap-0.5">
              <span className="display text-chestnut text-[19px] font-bold">
                {draft.nickname || draft.name}
              </span>
              <span className="text-mustache/70 text-[13px]">
                {draft.role === 'parent' ? 'Parent account' : 'Stash account'}
              </span>
            </div>
          </Card>

          <Field label="Photo" hint="A real face beats an initial. Optional.">
            <PhotoInput
              actorId={personId}
              value={avatarPhoto === 'keep'
                ? (draft.avatarUrl ? { id: 0, url: draft.avatarUrl, thumbUrl: draft.avatarUrl } : null)
                : avatarPhoto}
              onChange={setAvatarPhoto}
              label="Add a photo"
            />
          </Field>

          <Field label="Name">
            <TextField
              value={draft.name ?? ''}
              onChange={(name) => setDraft({ ...draft, name })}
              maxLength={80}
            />
          </Field>

          <Field label="Nickname" hint="What Stash calls them. Leave empty to use the name.">
            <TextField
              value={draft.nickname ?? ''}
              onChange={(nickname) => setDraft({ ...draft, nickname })}
              maxLength={80}
              placeholder={draft.name ?? ''}
            />
          </Field>

          {draft.role === 'kid' && (
            <Field label="Age">
              <input
                value={draft.age ?? ''}
                inputMode="numeric"
                onChange={(e) =>
                  setDraft({ ...draft, age: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })
                }
                placeholder="13"
                className={FIELD_CLASS}
              />
            </Field>
          )}

          <Field label="About" hint="A line that shows on their profile.">
            <TextField
              value={draft.about ?? ''}
              onChange={(about) => setDraft({ ...draft, about })}
              maxLength={240}
              placeholder="Saving up for concert tickets."
            />
          </Field>

          <Field label="Colour">
            <ColorPicker
              colors={AVATAR_COLORS}
              value={draft.avatarColor ?? AVATAR_COLORS[0]}
              onChange={(avatarColor) => setDraft({ ...draft, avatarColor })}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Eyebrow>Their Stash pose</Eyebrow>
            <div className="scroll-y flex gap-2 overflow-x-auto pb-1">
              {POSE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={POSES[key].moment}
                  aria-pressed={draft.mascotPose === key}
                  onClick={() => setDraft({ ...draft, mascotPose: key })}
                  className={cx(
                    'rounded-card shrink-0 border-2 p-2 transition-colors duration-150',
                    draft.mascotPose === key ? 'border-leaf bg-leaf/10' : 'border-line-cream bg-white',
                  )}
                >
                  <Mascot pose={key} height={64} />
                  <span className="text-mustache/70 mt-1 block text-[11px] font-bold capitalize">
                    {POSES[key].moment}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {canEditPin && (
            <Field label="Parent PIN" hint="Four digits. Leave empty to keep the current one.">
              <input
                value={pin}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder={draft.hasPin ? '••••' : 'Not set'}
                className={FIELD_CLASS}
              />
            </Field>
          )}

          {error2 && <p className="text-coral text-[14px] font-bold">{error2}</p>}
          {saved && !save.isPending && <p className="text-leaf-deep text-[14px] font-bold">Saved.</p>}

          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save profile
          </Button>
          <SmallButton variant="quiet" onClick={() => navigate(backTo)}>
            Done
          </SmallButton>
        </div>
      )}
    </Screen>
  )
}
