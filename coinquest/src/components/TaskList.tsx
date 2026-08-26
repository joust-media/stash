import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { KidHome, TaskRow } from '../../shared/types'
import { api } from '../lib/api'

/*
 * A task runs Start → End. Starting is optimistic — the tile flips immediately
 * — because it costs nothing if it fails. Ending is what alerts the parent, so
 * it waits for the server before handing off to the celebration.
 */

const KID_KEYS = (kidId: number) => [['kidHome', kidId], ['family'], ['approvals']] as const

export function useStartTask(kidId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: TaskRow) => api.startTask(task.choreId, kidId),
    onMutate: async (task: TaskRow) => {
      const key = ['kidHome', kidId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<KidHome>(key)
      queryClient.setQueryData<KidHome>(key, (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((t) =>
                t.choreId === task.choreId
                  ? { ...t, status: 'in_progress', startedAt: new Date().toISOString(), startedLabel: 'just now' }
                  : t,
              ),
            }
          : old,
      )
      return { previous, key }
    },
    onError: (_err, _task, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: () => {
      for (const key of KID_KEYS(kidId)) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useEndTask(kidId: number) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (task: TaskRow) => api.endTask(task.completionId!, kidId),
    onSuccess: (result) => {
      navigate(`/kid/${kidId}/done`, { state: result })
    },
    onSettled: () => {
      for (const key of KID_KEYS(kidId)) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useCancelTask(kidId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (task: TaskRow) => api.cancelTask(task.completionId!, kidId),
    onSettled: () => {
      for (const key of KID_KEYS(kidId)) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
