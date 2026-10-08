import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskListItem,
} from '../features/tasks/api'
import {
  listHorseOptions,
  listStaffOptions,
  type HorseOption,
  type StaffOption,
} from '../lib/options'
import { usePreferences } from '../lib/PreferencesContext'
import { getCurrentStableId } from '../lib/stableContext'
import type { Database } from '../types/supabase'

type Priority = Database['public']['Enums']['task_priority']
type PriorityFilter = 'all' | Priority
type StatusFilter = 'all' | 'incomplete' | 'completed'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

type TaskFormState = {
  title: string
  priority: Priority
  assigned_to: string
  horse_id: string
  due_date: string
  description: string
}

function emptyForm(): TaskFormState {
  return {
    title: '',
    priority: 'medium',
    assigned_to: '',
    horse_id: '',
    due_date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

function toForm(task: TaskListItem): TaskFormState {
  return {
    title: task.title,
    priority: task.priority,
    assigned_to: task.assigned_to ?? '',
    horse_id: task.horse_id ?? '',
    due_date: task.due_date ?? '',
    description: task.description ?? '',
  }
}

function TaskFields({
  form,
  staff,
  horses,
  onChange,
}: {
  form: TaskFormState
  staff: StaffOption[]
  horses: HorseOption[]
  onChange: <K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K],
  ) => void
}) {
  const { t } = usePreferences()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="field-label">{t('taskList.taskTitle')}</span>
        <input
          required
          className="field"
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('taskList.priority')}</span>
        <select
          className="field"
          value={form.priority}
          onChange={(e) => onChange('priority', e.target.value as Priority)}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('taskList.dueDate')}</span>
        <input
          type="date"
          className="field"
          value={form.due_date}
          onChange={(e) => onChange('due_date', e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">{t('taskList.assignedTo')}</span>
        <select
          className="field"
          value={form.assigned_to}
          onChange={(e) => onChange('assigned_to', e.target.value)}
        >
          <option value="">{t('taskList.unassigned')}</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name ?? t('taskList.unnamedStaff')}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">{t('taskList.horse')}</span>
        <select
          className="field"
          value={form.horse_id}
          onChange={(e) => onChange('horse_id', e.target.value)}
        >
          <option value="">{t('taskList.noHorse')}</option>
          {horses.map((horse) => (
            <option key={horse.id} value={horse.id}>
              {horse.name}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">{t('taskList.notes')}</span>
        <textarea
          className="field"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </label>
    </div>
  )
}

export default function TaskList() {
  const { t, formatDate } = usePreferences()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [horses, setHorses] = useState<HorseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<TaskFormState>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<TaskListItem | null>(null)
  const [editForm, setEditForm] = useState<TaskFormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<TaskListItem | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listTasks(), listStaffOptions(), listHorseOptions()])
      .then(([tasksData, staffData, horsesData]) => {
        if (!cancelled) {
          setTasks(tasksData)
          setStaff(staffData)
          setHorses(horsesData)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (priorityFilter === 'all' || task.priority === priorityFilter) &&
          (statusFilter === 'all' ||
            (statusFilter === 'completed' ? task.completed : !task.completed)),
      ),
    [tasks, priorityFilter, statusFilter],
  )

  function openAdd() {
    setAddForm(emptyForm())
    setAddError(null)
    setAddOpen(true)
  }

  function updateAddField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K],
  ) {
    setAddForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    setAddSaving(true)
    setAddError(null)
    try {
      const stableId = await getCurrentStableId()
      if (!stableId) throw new Error(t('taskList.noStableFound'))
      const created = await createTask({
        stable_id: stableId,
        title: addForm.title,
        priority: addForm.priority,
        assigned_to: addForm.assigned_to || null,
        horse_id: addForm.horse_id || null,
        due_date: addForm.due_date || null,
        description: addForm.description || null,
      })
      const horse = horses.find((h) => h.id === created.horse_id) ?? null
      const assignee = staff.find((s) => s.id === created.assigned_to) ?? null
      setTasks((prev) => [...prev, { ...created, horse, assignee }])
      setAddOpen(false)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAddSaving(false)
    }
  }

  function openEdit(task: TaskListItem) {
    setEditing(task)
    setEditForm(toForm(task))
    setEditError(null)
  }

  function updateEditField<K extends keyof TaskFormState>(
    key: K,
    value: TaskFormState[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateTask(editing.id, {
        title: editForm.title,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        horse_id: editForm.horse_id || null,
        due_date: editForm.due_date || null,
        description: editForm.description || null,
      })
      const horse = horses.find((h) => h.id === updated.horse_id) ?? null
      const assignee = staff.find((s) => s.id === updated.assigned_to) ?? null
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...updated, horse, assignee } : t)),
      )
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) return
    await deleteTask(deleteTarget.id)
    setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    if (editing?.id === deleteTarget.id) setEditing(null)
    setDeleteTarget(null)
  }

  async function toggleCompleted(task: TaskListItem) {
    const completed = !task.completed
    const updated = await updateTask(task.id, {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, ...updated } : t,
      ),
    )
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {t('taskList.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('taskList.subtitle')}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Icon name="plus" className="h-4 w-4" />
          {t('taskList.addTask')}
        </button>
      </div>

      <div className="panel p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="field"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          >
            <option value="all">{t('taskList.allPriorities')}</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">{t('taskList.allTasks')}</option>
            <option value="incomplete">{t('taskList.incomplete')}</option>
            <option value="completed">{t('taskList.completed')}</option>
          </select>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">{t('taskList.loading')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('taskList.failedToLoad', { error })}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={t('taskList.noTasksTitle')}
          message={t('taskList.noTasksMessage')}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="panel space-y-3 p-5">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleCompleted(task)}
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                    task.completed
                      ? 'border-forest bg-forest text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {task.completed ? '✓' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(task)}
                  className="text-left"
                >
                  <p
                    className={`font-medium ${
                      task.completed
                        ? 'text-slate-400 line-through'
                        : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[
                      task.due_date ? formatDate(task.due_date) : null,
                      task.assignee?.full_name,
                      task.horse?.name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {task.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {task.description}
                    </p>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={task.priority} />
                <Badge
                  status={task.completed ? 'completed' : 'scheduled'}
                  label={
                    task.completed ? t('taskList.completed') : t('taskList.open')
                  }
                />
                <button
                  type="button"
                  onClick={() => setDeleteTarget(task)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('taskList.addModalTitle')}
      >
        <form onSubmit={handleAddSubmit} className="grid gap-4">
          {addError && (
            <p role="alert" className="text-sm text-red-600">
              {addError}
            </p>
          )}
          <TaskFields
            form={addForm}
            staff={staff}
            horses={horses}
            onChange={updateAddField}
          />
          <button type="submit" disabled={addSaving} className="btn-primary">
            {addSaving ? t('common.saving') : t('taskList.save')}
          </button>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.title ?? ''}
      >
        <form onSubmit={handleEditSubmit} className="grid gap-4">
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <TaskFields
            form={editForm}
            staff={staff}
            horses={horses}
            onChange={updateEditField}
          />
          <button type="submit" disabled={editSaving} className="btn-primary">
            {editSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => editing && setDeleteTarget(editing)}
        >
          {t('common.delete')}
        </button>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('taskList.deleteTaskTitle')}
        message={t('taskList.confirmDelete')}
        onConfirm={confirmDeleteTask}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
