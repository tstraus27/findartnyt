import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Task,
  createTask,
  updateTask,
  deleteTask,
  computeQuadrant,
  compareByDueThenCreated,
  TimeHorizon,
  dateForQuadrant
} from './lib/tasks';
import { HORIZON_BY_LABEL, HORIZON_META } from './lib/horizons';
import { BackgroundStorage, type HeaderBgMeta } from './lib/backgroundStorage';

const emptyDraft = {
  title: '',
  notes: '',
  tags: '',
  list: 'Inbox',
  dueDate: '',
  dueTime: '',
  horizon: 'This Week' as TimeHorizon,
  scheduleMode: 'date' as 'date' | 'horizon'
};

const seed: Task[] = [
  createTask({
    title: 'Plan weekly priorities',
    notes: 'Focus on Q2 outcomes',
    tags: ['weekly', 'planning'],
    list: 'Work',
    dueAt: null,
    completed: false,
    completedAt: null,
    status: 'todo',
    archived: false,
    subtasks: []
  }),
  createTask({
    title: 'Pay rent',
    notes: '',
    tags: ['finance'],
    list: 'Home',
    dueAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    completed: false,
    completedAt: null,
    status: 'todo',
    archived: false,
    subtasks: []
  })
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(seed);
  const [draft, setDraft] = useState(emptyDraft);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskMounted, setNewTaskMounted] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editor, setEditor] = useState<{
    id: string;
    context: 'list' | 'matrix';
    rect: DOMRect;
  } | null>(null);
  const [composerMode, setComposerMode] = useState<'create' | 'edit'>('create');
  const [composerTaskId, setComposerTaskId] = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(true);
  const [showNewTaskTime, setShowNewTaskTime] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showRssTicker, setShowRssTicker] = useState(false);
  const [feeds, setFeeds] = useState<FeedConfig[]>([]);
  const [showManageFeeds, setShowManageFeeds] = useState(false);
  const [manageMounted, setManageMounted] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const viewBtnRef = useRef<HTMLButtonElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const [newTaskAnchor, setNewTaskAnchor] = useState<{
    x: number;
    y: number;
    horizon?: TimeHorizon;
    source?: 'quadrant' | 'global' | 'allTasks';
  } | null>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [pageTitle, setPageTitle] = useState('Tobias Straus Command Center');
  const [editingTitle, setEditingTitle] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [headerBgMeta, setHeaderBgMeta] = useState<HeaderBgMeta>({
    enabled: false,
    opacity: 0.35,
    blur: 6,
    preset: 'Frosted',
    updatedAt: Date.now()
  });
  const [headerBgUrl, setHeaderBgUrl] = useState<string | null>(null);
  const [showHeaderBg, setShowHeaderBg] = useState(false);
  const [headerBgMounted, setHeaderBgMounted] = useState(false);
  const [headerBgOpen, setHeaderBgOpen] = useState(false);
  const [headerBgAnchor, setHeaderBgAnchor] = useState<{ x: number; y: number } | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const leftWidthRef = useRef<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const closeFromTriggerRef = useRef<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.archived)
      .filter((t) => !t.completed)
      .filter((t) => (tagFilter ? t.tags.includes(tagFilter) : true));
  }, [tasks, tagFilter]);

  const doneTasks = useMemo(() => {
    return tasks
      .filter((t) => t.completed)
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      });
  }, [tasks]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.tags.forEach((tag) => s.add(tag)));
    return Array.from(s).sort();
  }, [tasks]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => setListCollapsed(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('lcc-left-width');
    if (saved) setLeftWidth(Number(saved));
  }, []);
  useEffect(() => {
    const savedTitle = localStorage.getItem('lcc-title');
    if (savedTitle) setPageTitle(savedTitle);
  }, []);
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') {
      setThemeMode(savedMode);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themeMode === 'system' ? (mq.matches ? 'dark' : 'light') : themeMode;
      document.documentElement.setAttribute('data-theme', resolved);
      setResolvedTheme(resolved);
    };
    applyTheme();
    if (themeMode === 'system') {
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
    return;
  }, [themeMode]);
  useEffect(() => {
    const savedFeeds = localStorage.getItem('lcc-feeds');
    if (savedFeeds) {
      setFeeds(JSON.parse(savedFeeds));
    } else {
      setFeeds(DEFAULT_FEEDS);
    }
  }, []);
  useEffect(() => {
    if (feeds.length) {
      localStorage.setItem('lcc-feeds', JSON.stringify(feeds));
    }
  }, [feeds]);
  useEffect(() => {
    const saved = localStorage.getItem('lcc-show-rss');
    if (saved) setShowRssTicker(saved === 'true');
  }, []);
  useEffect(() => {
    localStorage.setItem('lcc-show-rss', String(showRssTicker));
  }, [showRssTicker]);
  useEffect(() => {
    if (showManageFeeds) {
      setManageMounted(true);
      requestAnimationFrame(() => setManageOpen(true));
    } else {
      setManageOpen(false);
      if (manageMounted) {
        window.setTimeout(() => setManageMounted(false), 220);
      }
    }
  }, [showManageFeeds, manageMounted]);
  useEffect(() => {
    if (!editingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editingTitle]);
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    const saved = localStorage.getItem('headerAppearance');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HeaderBgMeta;
        setHeaderBgMeta(parsed);
      } catch {
        // ignore invalid
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('headerAppearance', JSON.stringify(headerBgMeta));
  }, [headerBgMeta]);

  useEffect(() => {
    let active = true;
    BackgroundStorage.getHeaderImage()
      .then((blob) => {
        if (!active) return;
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setHeaderBgUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (headerBgUrl) URL.revokeObjectURL(headerBgUrl);
    };
  }, [headerBgUrl]);

  useEffect(() => {
    if (showNewTask) {
      setNewTaskMounted(true);
      requestAnimationFrame(() => setNewTaskOpen(true));
    } else {
      setNewTaskOpen(false);
      if (newTaskMounted) {
        window.setTimeout(() => setNewTaskMounted(false), 220);
      }
    }
  }, [showNewTask, newTaskMounted]);

  useEffect(() => {
    if (editor) {
      setComposerMode('edit');
      setComposerTaskId(editor.id);
      setNewTaskAnchor({ x: editor.rect.left, y: editor.rect.top, source: 'global' });
      setShowNewTask(true);
      setEditor(null);
    }
  }, [editor]);

  useEffect(() => {
    if (showHeaderBg) {
      setHeaderBgMounted(true);
      requestAnimationFrame(() => setHeaderBgOpen(true));
    } else {
      setHeaderBgOpen(false);
      if (headerBgMounted) {
        window.setTimeout(() => setHeaderBgMounted(false), 220);
      }
    }
  }, [showHeaderBg, headerBgMounted]);

  const openHeaderBg = (anchor: { x: number; y: number }) => {
    if (showHeaderBg) {
      setShowHeaderBg(false);
      window.setTimeout(() => {
        setHeaderBgAnchor(anchor);
        setShowHeaderBg(true);
      }, 220);
      return;
    }
    setHeaderBgAnchor(anchor);
    setShowHeaderBg(true);
  };

  const closeNewTask = () => {
    setShowNewTask(false);
    window.setTimeout(() => setNewTaskAnchor(null), 220);
  };

  const openNewTask = (anchor: { x: number; y: number; horizon?: TimeHorizon; source?: 'quadrant' | 'global' | 'allTasks' }) => {
    if (editor) {
      setEditor(null);
      window.setTimeout(() => {
        setNewTaskAnchor(anchor);
        setComposerMode('create');
        setComposerTaskId(null);
        setShowNewTask(true);
      }, 220);
      return;
    }
    if (showNewTask) {
      setShowNewTask(false);
      window.setTimeout(() => {
        setNewTaskAnchor(anchor);
        setComposerMode('create');
        setComposerTaskId(null);
        setShowNewTask(true);
      }, 220);
      return;
    }
    setNewTaskAnchor(anchor);
    setComposerMode('create');
    setComposerTaskId(null);
    setShowNewTask(true);
  };


  useEffect(() => {
    if (!showViewMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!viewMenuRef.current || !viewBtnRef.current) return;
      if (
        viewMenuRef.current.contains(e.target as Node) ||
        viewBtnRef.current.contains(e.target as Node)
      ) {
        return;
      }
      setShowViewMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowViewMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showViewMenu]);

  const onCreate = (payload: {
    title: string;
    notes: string;
    tags: string[];
    dueDate: string;
    dueTime: string;
    horizon: TimeHorizon;
    scheduleMode: 'date' | 'horizon';
    subtasks: string[];
    mode: 'create' | 'edit';
    taskId?: string | null;
  }) => {
    if (!payload.title.trim()) return;
    const effectiveMode =
      payload.dueDate || payload.dueTime
        ? 'date'
        : (payload.scheduleMode === 'horizon' || payload.horizon ? 'horizon' : 'date');
    const dueAt =
      effectiveMode === 'date'
        ? (payload.dueDate ? (payload.dueTime ? `${payload.dueDate}T${payload.dueTime}` : payload.dueDate) : null)
        : dateForQuadrant(payload.horizon);
    if (payload.mode === 'edit' && payload.taskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === payload.taskId
            ? updateTask(t, {
                title: payload.title.trim(),
                notes: payload.notes.trim(),
                tags: payload.tags,
                dueAt,
                subtasks: payload.subtasks
              })
            : t
        )
      );
    } else {
      const task = createTask({
        title: payload.title.trim(),
        notes: payload.notes.trim(),
        tags: payload.tags,
        list: draft.list.trim() || 'Inbox',
        dueAt,
        completed: false,
        completedAt: null,
        status: 'todo',
        archived: false,
        subtasks: payload.subtasks
      });
      setTasks((prev) => [task, ...prev]);
    }
    setDraft(emptyDraft);
    setShowNewTask(false);
    setShowNewTaskTime(false);
    setNewTaskAnchor(null);
    setComposerMode('create');
    setComposerTaskId(null);
  };

  const onUpdate = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? updateTask(t, patch) : t)));
  };

  const onToggleComplete = (id: string, done: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? updateTask(t, {
              completed: done,
              completedAt: done ? new Date().toISOString() : null,
              status: done ? 'done' : 'todo'
            })
          : t
      )
    );
  };

  const onDelete = (id: string) => {
    setTasks((prev) => deleteTask(prev, id));
  };

  const horizonOrder = useMemo(() => {
    const order = new Map<TimeHorizon, number>();
    HORIZON_META.forEach((meta, idx) => order.set(meta.label, idx));
    return order;
  }, []);

  const listTasks = [...visibleTasks].sort((a, b) => {
    const ha = horizonOrder.get(computeQuadrant(a)) ?? 0;
    const hb = horizonOrder.get(computeQuadrant(b)) ?? 0;
    if (ha !== hb) return ha - hb;
    return compareByDueThenCreated(a, b);
  });

  const matrix = {
    Today: visibleTasks.filter((t) => computeQuadrant(t) === 'Today'),
    'This Week': visibleTasks.filter((t) => computeQuadrant(t) === 'This Week'),
    Upcoming: visibleTasks.filter((t) => computeQuadrant(t) === 'Upcoming'),
    'Open-ended': visibleTasks.filter((t) => computeQuadrant(t) === 'Open-ended')
  };

  const scrimDefaults = resolvedTheme === 'dark'
    ? { scrimAlpha: 0.38, blur: 10, opacity: 0.35 }
    : { scrimAlpha: 0.22, blur: 6, opacity: 0.35 };

  const effectiveHeaderBg = {
    enabled: headerBgMeta.enabled && !!headerBgUrl,
    opacity: headerBgMeta.opacity ?? scrimDefaults.opacity,
    blur: headerBgMeta.blur ?? scrimDefaults.blur,
    scrimAlpha: scrimDefaults.scrimAlpha,
    preset: headerBgMeta.preset
  };

  return (
    <div className="app">
      <header
        className="topbar"
        ref={headerRef}
        style={
          effectiveHeaderBg.enabled
            ? ({
                ['--header-bg-url' as string]: `url(${headerBgUrl})`,
                ['--header-bg-opacity' as string]: effectiveHeaderBg.opacity,
                ['--header-bg-blur' as string]: `${effectiveHeaderBg.blur}px`,
                ['--header-bg-scrim' as string]: effectiveHeaderBg.scrimAlpha
              } as React.CSSProperties)
            : undefined
        }
      >
        {effectiveHeaderBg.enabled && (
          <div className="header-bg-layer" aria-hidden>
            <div className="header-bg-image" />
            <div className="header-bg-scrim" />
          </div>
        )}
        <RssTicker
          visible={showRssTicker}
          feeds={feeds}
          setFeeds={setFeeds}
          onManage={() => setShowManageFeeds(true)}
        />
        <div className="topbar-inner">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="title-input"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                localStorage.setItem('lcc-title', pageTitle.trim() || 'Tobias Straus Command Center');
                if (!pageTitle.trim()) setPageTitle('Tobias Straus Command Center');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  const savedTitle = localStorage.getItem('lcc-title') || 'Tobias Straus Command Center';
                  setPageTitle(savedTitle);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h1 onDoubleClick={() => setEditingTitle(true)}>{pageTitle}</h1>
          )}
          <div className="top-controls">
            <button
              className="primary btn-compact newtask-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (newTaskMounted && newTaskAnchor?.source === 'global') {
                  closeFromTriggerRef.current = 'global';
                  closeNewTask();
                }
              }}
              onClick={(e) => {
                if (closeFromTriggerRef.current === 'global') {
                  closeFromTriggerRef.current = null;
                  return;
                }
                if (showNewTask) {
                  closeNewTask();
                  return;
                }
                openNewTask({ x: e.clientX, y: e.clientY, source: 'global' });
              }}
            >
              <span className="plus-icon">+</span>
              New Task
            </button>
            <div className="view-menu-wrap">
              <button
                ref={viewBtnRef}
                className={`ghost btn-compact view-btn ${showViewMenu ? 'active' : ''}`}
                onClick={() => setShowViewMenu((v) => !v)}
              >
                View ▾
              </button>
              {showViewMenu && (
                <div className="view-menu" ref={viewMenuRef}>
                  <label className="menu-item">
                    <input
                      type="checkbox"
                      checked={!listCollapsed}
                      onChange={() => setListCollapsed((v) => !v)}
                    />
                    Show All Tasks
                  </label>
                  <label className="menu-item">
                    <input
                      type="checkbox"
                      checked={showCompleted}
                      onChange={() => setShowCompleted((v) => !v)}
                    />
                    Show Completed
                  </label>
                  <div className="menu-divider" />
                  <label className="menu-item">
                    <input
                      type="checkbox"
                      checked={showRssTicker}
                      onChange={() => setShowRssTicker((v) => !v)}
                    />
                    Show RSS Ticker
                  </label>
                  <div className="menu-divider" />
                  <div className="menu-section">Appearance</div>
                  <label className="menu-item">
                    <input
                      type="radio"
                      name="appearance"
                      checked={themeMode === 'system'}
                      onChange={() => setThemeMode('system')}
                    />
                    System
                  </label>
                  <label className="menu-item">
                    <input
                      type="radio"
                      name="appearance"
                      checked={themeMode === 'light'}
                      onChange={() => setThemeMode('light')}
                    />
                    Light
                  </label>
                  <label className="menu-item">
                    <input
                      type="radio"
                      name="appearance"
                      checked={themeMode === 'dark'}
                      onChange={() => setThemeMode('dark')}
                    />
                    Dark
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          className="header-appearance-trigger"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            openHeaderBg({ x: rect.left + rect.width / 2, y: rect.bottom });
          }}
          aria-label="Header appearance"
          title="Header appearance"
        >
          <span className="icon-glyph">≋</span>
        </button>
        <section className="action-area-placeholder" />
      </header>

      <section className="workspace" ref={workspaceRef}>
        <div className={`left-list ${listCollapsed ? 'collapsed' : ''}`} style={leftWidth ? { width: leftWidth } : undefined}>
          <button className="list-toggle" onClick={() => setListCollapsed((v) => !v)}>
            {listCollapsed ? 'Show All Tasks' : 'Hide All Tasks'}
          </button>
          <h2>All Tasks</h2>
          <button
            className="quad-add alltasks-add"
            title="Add task"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (newTaskMounted && newTaskAnchor?.source === 'allTasks') {
                closeFromTriggerRef.current = 'allTasks';
                closeNewTask();
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (closeFromTriggerRef.current === 'allTasks') {
                closeFromTriggerRef.current = null;
                return;
              }
              if (showNewTask && newTaskAnchor?.source === 'allTasks') {
                closeNewTask();
                return;
              }
              openNewTask({ x: e.clientX, y: e.clientY, source: 'allTasks' });
            }}
          >
            {newTaskMounted && newTaskAnchor?.source === 'allTasks' ? '–' : '+'}
          </button>
          <div
            className="list"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              const fromDone = e.dataTransfer.getData('fromDone') === '1';
              if (!id || !fromDone) return;
              onToggleComplete(id, false);
            }}
          >
            {listTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onUpdate={onUpdate}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                context="list"
                onOpen={(id, context, rect) => {
                  if (showNewTask) setShowNewTask(false);
                  setEditor({ id, context, rect });
                }}
                compact
                draggable
              />
            ))}
          </div>
        </div>
        {!listCollapsed && (
          <div
            className="splitter"
            onMouseDown={(e) => {
              if (!workspaceRef.current) return;
              isDraggingRef.current = true;
              const startX = e.clientX;
              const rect = workspaceRef.current.getBoundingClientRect();
              const startLeft = leftWidth ?? rect.width * 0.4;

              const onMove = (ev: MouseEvent) => {
                if (!isDraggingRef.current || !workspaceRef.current) return;
                const containerWidth = workspaceRef.current.getBoundingClientRect().width;
                const minLeft = 280;
                const maxLeft = Math.min(containerWidth * 0.55, containerWidth - 420);
                const next = Math.max(minLeft, Math.min(maxLeft, startLeft + (ev.clientX - startX)));
                setLeftWidth(next);
              };

              const onUp = () => {
                isDraggingRef.current = false;
                if (leftWidthRef.current) {
                  localStorage.setItem('lcc-left-width', String(leftWidthRef.current));
                }
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };

              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />
        )}
        <section className="matrix">
          {HORIZON_META.map((meta) => (
            <QuadrantCard
              key={meta.id}
              className={`quadrant q-${meta.id}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                const fromDone = e.dataTransfer.getData('fromDone') === '1';
                if (!id) return;
                if (fromDone) {
                  onToggleComplete(id, false);
                }
                onUpdate(id, { dueAt: dateForQuadrant(meta.label) });
              }}
            >
              <div className="quad-header">
                <h3 className={`quad-title horizon-${meta.id}`}>
                  {meta.label}
                </h3>
                <button
                  className="quad-add"
                  title="Add task"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (newTaskMounted && newTaskAnchor?.source === 'quadrant' && newTaskAnchor.horizon === meta.label) {
                      closeFromTriggerRef.current = meta.label;
                      closeNewTask();
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (closeFromTriggerRef.current === meta.label) {
                      closeFromTriggerRef.current = null;
                      return;
                    }
                    if (newTaskMounted && newTaskAnchor?.source === 'quadrant' && newTaskAnchor.horizon === meta.label) {
                      closeNewTask();
                      return;
                    }
                    setDraft((d) => ({
                      ...d,
                      scheduleMode: 'horizon',
                      horizon: meta.label,
                      dueDate: '',
                      dueTime: ''
                    }));
                    setShowNewTaskTime(false);
                    openNewTask({ x: e.clientX, y: e.clientY, horizon: meta.label, source: 'quadrant' });
                  }}
                >
                  {newTaskMounted && newTaskAnchor?.source === 'quadrant' && newTaskAnchor.horizon === meta.label ? '–' : '+'}
                </button>
              </div>
              <div
                className="quad-body"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/plain');
                  const fromDone = e.dataTransfer.getData('fromDone') === '1';
                  if (!id) return;
                  if (fromDone) {
                    onToggleComplete(id, false);
                  }
                  onUpdate(id, { dueAt: dateForQuadrant(meta.label) });
                }}
              >
                {matrix[meta.label].length === 0 ? (
                  <div className="quad-empty">No tasks</div>
                ) : (
                  matrix[meta.label].sort(compareByDueThenCreated).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onUpdate={onUpdate}
                      onToggleComplete={onToggleComplete}
                      onDelete={onDelete}
                      context="matrix"
                      onOpen={(id, context, rect) => {
                        if (showNewTask) setShowNewTask(false);
                        setEditor({ id, context, rect });
                      }}
                      compact
                      draggable
                    />
                  ))
                )}
              </div>
            </QuadrantCard>
          ))}
        </section>
      </section>
      {showCompleted && (
        <section
          className="completed-section"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            onToggleComplete(id, true);
          }}
        >
          <div className="completed-header">
            <h3>Completed</h3>
            <span className="completed-chevron">▾</span>
          </div>
          <div className="completed-list">
            {doneTasks.map((t) => (
              <div
                key={t.id}
                className="completed-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', t.id);
                  e.dataTransfer.setData('fromDone', '1');
                }}
              >
                <div className="completed-title">{t.title}</div>
                {t.completedAt ? (
                  <div className="completed-meta">
                    {new Date(t.completedAt).toLocaleString()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
      {newTaskMounted && (
        <NewTaskOverlay
          draft={draft}
          setDraft={setDraft}
          showTime={showNewTaskTime}
          setShowTime={setShowNewTaskTime}
          onClose={() => {
            closeNewTask();
          }}
          onCreate={onCreate}
          mode={composerMode}
          task={composerTaskId ? tasks.find((t) => t.id === composerTaskId) || null : null}
          anchor={newTaskAnchor}
          isOpen={newTaskOpen}
          allTags={allTags}
        />
      )}
      {manageMounted && (
        <ManageFeedsPanel
          feeds={feeds}
          setFeeds={setFeeds}
          onClose={() => setShowManageFeeds(false)}
          isOpen={manageOpen}
        />
      )}
      {headerBgMounted && (
        <HeaderBackgroundPanel
          meta={headerBgMeta}
          setMeta={setHeaderBgMeta}
          imageUrl={headerBgUrl}
          setImageUrl={setHeaderBgUrl}
          anchor={headerBgAnchor}
          isOpen={headerBgOpen}
          onClose={() => setShowHeaderBg(false)}
          resolvedTheme={resolvedTheme}
        />
      )}
    </div>
  );
}

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  sourceName: string;
};

type FeedConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status?: 'ok' | 'error';
};

const DEFAULT_FEEDS: FeedConfig[] = [
  { id: 'f1', name: 'Example Feed', url: 'https://example.com/rss', enabled: true },
  { id: 'f2', name: 'Example Atom', url: 'https://example.com/atom.xml', enabled: false }
];

const RSS_PROXY_URL = ''; // Optional: set to a proxy base, e.g. https://your-proxy.com?url=

const RssTicker = ({
  visible,
  feeds,
  setFeeds,
  onManage
}: {
  visible: boolean;
  feeds: FeedConfig[];
  setFeeds: React.Dispatch<React.SetStateAction<FeedConfig[]>>;
  onManage: () => void;
}) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const fetchFeeds = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const enabledFeeds = feeds.filter((f) => f.enabled);
      const results = await Promise.all(
        enabledFeeds.map(async (f) => {
          const url = RSS_PROXY_URL ? `${RSS_PROXY_URL}${encodeURIComponent(f.url)}` : f.url;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, 'text/xml');
          const isAtom = doc.querySelector('feed') !== null;
          const entries = isAtom ? Array.from(doc.querySelectorAll('entry')) : Array.from(doc.querySelectorAll('item'));
          const items = entries.map((node) => {
            const title = node.querySelector('title')?.textContent?.trim() || 'Untitled';
            const linkNode = isAtom ? node.querySelector('link') : node.querySelector('link');
            const link = isAtom
              ? (linkNode?.getAttribute('href') || '')
              : (linkNode?.textContent?.trim() || '');
            const pubDate = (node.querySelector('pubDate')?.textContent ||
              node.querySelector('updated')?.textContent ||
              node.querySelector('published')?.textContent ||
              '') as string;
            return { title, link, pubDate, sourceName: f.name };
          });
          setFeeds((prev) => prev.map((p) => (p.id === f.id ? { ...p, status: 'ok' } : p)));
          return items;
        })
      );
      const flattened = results.flat().filter((i) => i.title && i.link);
      setItems(flattened);
      setStatus('idle');
    } catch (err) {
      setFeeds((prev) => prev.map((p) => (p.enabled ? { ...p, status: 'error' } : p)));
      setStatus('error');
      setErrorMsg('RSS blocked by CORS. Configure a proxy to enable.');
    }
  };

  useEffect(() => {
    if (!visible) return;
    fetchFeeds();
    const id = window.setInterval(fetchFeeds, 20 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) {
    return <div className="ticker-band hidden" aria-hidden />;
  }

  if (status === 'error') {
    return (
      <div className="ticker-band">
        <div className="ticker-inner">
          <span className="ticker-label">RSS</span>
          <span className="ticker-error">{errorMsg}</span>
          <button className="ticker-manage" onClick={onManage}>
            Manage Feeds…
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ticker-band ${reducedMotion ? 'reduced' : ''}`}>
      <div className="ticker-inner">
        <span className="ticker-label">RSS</span>
        {status === 'loading' && items.length === 0 ? (
          <span className="ticker-loading">Loading headlines…</span>
        ) : (
          <div className="ticker-track">
            <div className="ticker-items">
              {items.map((i, idx) => (
                <a key={`${i.link}-${idx}`} href={i.link} target="_blank" rel="noreferrer">
                  {i.sourceName}: {i.title}
                </a>
              ))}
            </div>
            {!reducedMotion && (
              <div className="ticker-items" aria-hidden>
                {items.map((i, idx) => (
                  <a key={`${i.link}-dup-${idx}`} href={i.link} target="_blank" rel="noreferrer">
                    {i.sourceName}: {i.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="ticker-manage" onClick={onManage}>
          Manage Feeds…
        </button>
      </div>
    </div>
  );
};

const ManageFeedsPanel = ({
  feeds,
  setFeeds,
  onClose,
  isOpen
}: {
  feeds: FeedConfig[];
  setFeeds: React.Dispatch<React.SetStateAction<FeedConfig[]>>;
  onClose: () => void;
  isOpen: boolean;
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const addFeed = () => {
    try {
      const u = new URL(newUrl);
      if (feeds.some((f) => f.url === newUrl)) return;
      const name = newName.trim() || u.hostname.replace('www.', '');
      setFeeds((prev) => [
        ...prev,
        { id: `f-${Date.now()}`, name, url: newUrl, enabled: true }
      ]);
      setNewUrl('');
      setNewName('');
    } catch {
      // ignore invalid
    }
  };

  return createPortal(
    <div className="overlay-root">
      <div className={`overlay-panel utility-panel ${isOpen ? 'open' : 'closing'}`} ref={panelRef}>
        <div className="overlay-header">
          <div className="overlay-title">Manage Feeds</div>
          <button className="overlay-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="feed-list">
          {feeds.map((f) => (
            <div key={f.id} className="feed-row">
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={() => setFeeds((prev) => prev.map((p) => (p.id === f.id ? { ...p, enabled: !p.enabled } : p)))}
              />
              <input
                className="feed-name"
                value={f.name}
                onChange={(e) => setFeeds((prev) => prev.map((p) => (p.id === f.id ? { ...p, name: e.target.value } : p)))}
              />
              <input
                className="feed-url"
                value={f.url}
                onChange={(e) => setFeeds((prev) => prev.map((p) => (p.id === f.id ? { ...p, url: e.target.value } : p)))}
              />
              <span className={`feed-status ${f.status || 'ok'}`}>{f.status || 'ok'}</span>
              <button className="ghost" onClick={() => setFeeds((prev) => prev.filter((p) => p.id !== f.id))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="feed-add">
          <input
            className="feed-url"
            placeholder="RSS URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <input
            className="feed-name"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="primary btn-compact" onClick={addFeed}>Add</button>
        </div>
        <div className="feed-actions">
          <button className="ghost" onClick={() => setFeeds((prev) => [...prev])}>Refresh now</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

type TaskCardProps = {
  task: Task;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onToggleComplete: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  draggable?: boolean;
  context: 'list' | 'matrix';
  onOpen?: (id: string, context: 'list' | 'matrix', rect: DOMRect) => void;
};

const TaskCard = ({
  task,
  onUpdate,
  onToggleComplete,
  onDelete,
  compact,
  draggable,
  context,
  onOpen
}: TaskCardProps) => {
  const formatDueLabel = (dueAt: string | null) => {
    if (!dueAt) return 'No due date';
    if (dueAt.includes('T')) return new Date(dueAt).toLocaleString();
    const [y, m, d] = dueAt.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  };
  const getNotesPreview = (notes: string) => {
    const firstLine = notes
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) return '';
    const limit = 84;
    return firstLine.length > limit ? `${firstLine.slice(0, limit - 1)}…` : firstLine;
  };

  const cardRef = useRef<HTMLDivElement | null>(null);
  const horizonLabel = computeQuadrant(task);
  const horizonMeta = HORIZON_BY_LABEL[horizonLabel];
  const notesPreview = task.notes ? getNotesPreview(task.notes) : '';
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <div
      ref={cardRef}
      className={`task ${task.status} ${compact ? 'compact' : ''} horizon-${horizonMeta.id}`}
      draggable={!!draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.setData('fromDone', '0');
      }}
    >
      <div className="task-header title-bar">
        <input
          type="checkbox"
          checked={task.completed}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.checked) {
              onToggleComplete(task.id, true);
            } else {
              onToggleComplete(task.id, false);
            }
          }}
        />
        <button
          className="task-title"
          onClick={() => {
            if (!cardRef.current) return;
            onOpen?.(task.id, context, cardRef.current.getBoundingClientRect());
          }}
        >
          {task.title}
        </button>
        {!compact && (
          <button className="ghost" onClick={() => onDelete(task.id)}>Delete</button>
        )}
      </div>
      {compact ? (
        <div className="task-compact-meta">
          <span className={`horizon-label horizon-${horizonMeta.id}`}>
            {horizonMeta.label}
          </span>
          <span className="due-label">
            {formatDueLabel(task.dueAt)}
          </span>
          {notesPreview ? (
            <div className="notes-preview">{notesPreview}</div>
          ) : null}
          {hasSubtasks ? (
            <div className="desc-preview subtasks-preview">
              {task.subtasks.slice(0, 3).map((s, idx) => (
                <div key={`${task.id}-sub-${idx}`} className="subtask-preview">
                  {s}
                </div>
              ))}
              {task.subtasks.length > 3 ? (
                <div className="subtask-more">+{task.subtasks.length - 3} more</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

type NewTaskOverlayProps = {
  draft: typeof emptyDraft;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyDraft>>;
  showTime: boolean;
  setShowTime: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    notes: string;
    tags: string[];
    dueDate: string;
    dueTime: string;
    horizon: TimeHorizon;
    scheduleMode: 'date' | 'horizon';
    subtasks: string[];
    mode: 'create' | 'edit';
    taskId?: string | null;
  }) => void;
  mode: 'create' | 'edit';
  task: Task | null;
  anchor: { x: number; y: number; horizon?: TimeHorizon } | null;
  isOpen: boolean;
  allTags: string[];
};

const NewTaskOverlay = ({
  draft,
  setDraft,
  showTime,
  setShowTime,
  onClose,
  onCreate,
  mode,
  task,
  anchor,
  isOpen,
  allTags
}: NewTaskOverlayProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [hasOpened, setHasOpened] = useState(false);
  const [showHorizon, setShowHorizon] = useState(false);
  const [tagHelperOpen, setTagHelperOpen] = useState(false);
  const [tagHelperQuery, setTagHelperQuery] = useState('');
  const [tagHelperBlock, setTagHelperBlock] = useState<string | null>(null);
  const [tagHelperIndex, setTagHelperIndex] = useState<number | null>(null);
  const [tagHelperPos, setTagHelperPos] = useState<{ x: number; y: number }>({ x: 8, y: 8 });
  const [blocks, setBlocks] = useState<Array<
    | { id: string; type: 'note'; text: string }
    | { id: string; type: 'subtask'; text: string; done: boolean; fromDash?: boolean }
  >>([]);
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});
  const pendingFocusRef = useRef<{ id: string; caret?: number } | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const showWhen = showTime;
  const setShowWhen = setShowTime;
  const activeHorizon = HORIZON_BY_LABEL[draft.horizon];

  useEffect(() => {
    if (!anchor) return;
    const width = 380;
    const height = 420;
    let x = anchor.x + 12;
    let y = anchor.y + 12;
    const maxX = window.innerWidth - width - 16;
    const maxY = window.innerHeight - height - 16;
    x = Math.max(16, Math.min(maxX, x));
    const fitsBelow = anchor.y + height + 16 <= window.innerHeight;
    if (!fitsBelow) {
      y = anchor.y - height - 12;
    }
    y = Math.max(16, Math.min(maxY, y));
    setPos({ x, y });
  }, [anchor]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setShowHorizon(false);
    if (mode === 'edit' && task) {
      const nextBlocks: Array<
        | { id: string; type: 'note'; text: string }
        | { id: string; type: 'subtask'; text: string; done: boolean }
      > = [];
      const notes = task.notes ? `${task.notes}` : '';
      if (notes.trim()) {
        nextBlocks.push({ id: crypto.randomUUID(), type: 'note', text: notes });
      } else {
        nextBlocks.push({ id: crypto.randomUUID(), type: 'note', text: '' });
      }
      if (task.subtasks && task.subtasks.length) {
        task.subtasks.forEach((s) => {
          nextBlocks.push({ id: crypto.randomUUID(), type: 'subtask', text: s, done: false });
        });
      }
      setBlocks(nextBlocks);
      setDraft((prev) => ({
        ...prev,
        title: task.title,
        notes: task.notes,
        tags: task.tags.join(', '),
        dueDate: task.dueAt && task.dueAt.includes('T') ? task.dueAt.split('T')[0] : (task.dueAt ?? ''),
        dueTime: task.dueAt && task.dueAt.includes('T') ? task.dueAt.split('T')[1].slice(0, 5) : '',
        scheduleMode: task.dueAt ? 'date' : 'horizon'
      }));
      setShowTime(false);
    } else {
      setBlocks([{ id: crypto.randomUUID(), type: 'note', text: '' }]);
    }
    setShowTime(false);
  }, [isOpen, setShowTime, mode, task, setDraft]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const isDraftEmpty = () => {
    return !draft.title.trim();
  };

  const parseInline = (raw: string) => {
    const parts = raw.split(/\s+/);
    const tags: string[] = [];
    let horizon: TimeHorizon | null = null;
    const kept: string[] = [];
    parts.forEach((p) => {
      if (p.startsWith('#') && p.length > 1) {
        tags.push(p.slice(1));
        return;
      }
      if (p === '!flag') {
        tags.push('flag');
        return;
      }
      if (p.startsWith('@')) {
        const t = p.slice(1).toLowerCase();
        if (t === 'today') horizon = 'Today';
        else if (t === 'week' || t === 'thisweek') horizon = 'This Week';
        else if (t === 'upcoming') horizon = 'Upcoming';
        else if (t === 'someday' || t === 'open' || t === 'open-ended') horizon = 'Open-ended';
        else kept.push(p);
        return;
      }
      kept.push(p);
    });
    return { title: kept.join(' ').trim(), tags, horizon };
  };

  const serializeBlocks = (
    source: Array<
      | { id: string; type: 'note'; text: string }
      | { id: string; type: 'subtask'; text: string; done: boolean; fromDash?: boolean }
    > = blocks
  ) => {
    const notes = source
      .filter((b) => b.type === 'note')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const subtasks = source
      .filter((b) => b.type === 'subtask')
      .map((b) => b.text)
      .filter(Boolean);
    return { notes, subtasks };
  };

  const getBlocksSnapshot = () => {
    return blocks.map((block) => {
      const el = blockRefs.current[block.id];
      if (el && 'value' in el) {
        return { ...block, text: (el as HTMLInputElement | HTMLTextAreaElement).value };
      }
      return block;
    });
  };

  const commitCreate = () => {
    const inline = parseInline(draft.title);
    const parsedBody = serializeBlocks(getBlocksSnapshot());
    const extraTags = draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const mergedTags = Array.from(new Set([...extraTags, ...inline.tags]));
    const finalTitle = inline.title || draft.title.trim();
    const finalHorizon = inline.horizon ?? draft.horizon;
    const finalScheduleMode = draft.dueDate || draft.dueTime ? 'date' : (inline.horizon ? 'horizon' : draft.scheduleMode);
    onCreate({
      title: finalTitle,
      notes: parsedBody.notes,
      tags: mergedTags,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      horizon: finalHorizon,
      scheduleMode: finalScheduleMode,
      subtasks: parsedBody.subtasks,
      mode,
      taskId: task?.id ?? null
    });
  };

  const requestClose = (force?: boolean) => {
    if (isDraftEmpty()) {
      onClose();
      return;
    }
    if (force) {
      commitCreate();
      return;
    }
  };

  const focusBlock = (id: string, caret?: number) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current[id];
      el?.focus();
      if (el && 'setSelectionRange' in el) {
        const valueLen = (el as HTMLInputElement).value.length;
        const pos = caret ?? valueLen;
        (el as HTMLInputElement).setSelectionRange(pos, pos);
      }
    });
  };

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const { id, caret } = pendingFocusRef.current;
    pendingFocusRef.current = null;
    focusBlock(id, caret);
  }, [blocks]);

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      blocks.forEach((block) => {
        const el = blockRefs.current[block.id];
        if (el && el instanceof HTMLTextAreaElement) autosize(el);
      });
    });
  }, [blocks, isOpen]);

  const insertBlockAfter = (index: number, block: { id: string; type: 'note' | 'subtask'; text: string; done?: boolean; fromDash?: boolean }) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, block as any);
      return next;
    });
    pendingFocusRef.current = { id: block.id };
  };

  const closeTagHelper = () => {
    setTagHelperOpen(false);
    setTagHelperQuery('');
    setTagHelperBlock(null);
    setTagHelperIndex(null);
  };

  const updateTagHelperPosition = (el: HTMLTextAreaElement) => {
    if (!workspaceRef.current) return;
    const ws = workspaceRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setTagHelperPos({
      x: Math.max(8, rect.left - ws.left + 6),
      y: rect.bottom - ws.top + 4
    });
  };

  const insertTag = (tag: string) => {
    if (!tagHelperBlock || tagHelperIndex === null) return;
    const el = blockRefs.current[tagHelperBlock];
    if (!el || !(el instanceof HTMLTextAreaElement)) return;
    const caret = el.selectionStart ?? el.value.length;
    const start = tagHelperIndex;
    const before = el.value.slice(0, start);
    const after = el.value.slice(caret);
    const nextText = `${before}${tag}${after}`;
    setBlocks((prev) =>
      prev.map((b) => (b.id === tagHelperBlock ? { ...b, text: nextText } : b))
    );
    const existing = draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!existing.includes(tag)) {
      setDraft((prev) => ({ ...prev, tags: [...existing, tag].join(', ') }));
    }
    closeTagHelper();
    pendingFocusRef.current = { id: tagHelperBlock, caret: before.length + tag.length };
  };

  const tagSuggestions = useMemo(() => {
    if (!tagHelperOpen) return [];
    const query = tagHelperQuery.trim().toLowerCase();
    const matches = allTags.filter((t) => t.toLowerCase().startsWith(query));
    return matches.slice(0, 6);
  }, [tagHelperOpen, tagHelperQuery, allTags]);

  const replaceLineWithSubtask = (
    blockIndex: number,
    lineStart: number,
    lineEnd: number,
    subText: string
  ) => {
    const subId = crypto.randomUUID();
    setBlocks((prev) => {
      const next = [...prev];
      const block = next[blockIndex];
      if (block.type !== 'note') return prev;
      const before = block.text.slice(0, lineStart);
      const after = block.text.slice(lineEnd);
      const beforeClean = before.replace(/\n{3,}/g, '\n\n').replace(/\n$/, '');
      const afterClean = after.replace(/^\n/, '');
      const blocksToInsert: typeof next = [];
      if (beforeClean.trim().length) {
        blocksToInsert.push({ ...block, text: beforeClean });
      }
      const sub = { id: subId, type: 'subtask' as const, text: subText, done: false, fromDash: true };
      blocksToInsert.push(sub as any);
      if (afterClean.trim().length) {
        blocksToInsert.push({ id: crypto.randomUUID(), type: 'note', text: afterClean } as any);
      }
      next.splice(blockIndex, 1, ...blocksToInsert);
      return next;
    });
    pendingFocusRef.current = { id: subId };
  };

  const replaceSubtaskWithNote = (index: number, text: string, caret = 0) => {
    const noteId = crypto.randomUUID();
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1, { id: noteId, type: 'note', text });
      return next;
    });
    pendingFocusRef.current = { id: noteId, caret };
  };

  // body parsing handled via block model

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!isOpen) return;
      if (!panelRef.current) return;
      if (draggingRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) return;
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isOpen]);

  const originX = anchor ? anchor.x - pos.x : 20;
  const originY = anchor ? anchor.y - pos.y : 20;

  return createPortal(
    <div className="overlay-root">
      <div
        className={`overlay-panel utility-panel task-composer ${isOpen ? 'open' : hasOpened ? 'closing' : 'closed'}`}
        ref={panelRef}
        style={{ left: pos.x, top: pos.y, transformOrigin: `${originX}px ${originY}px` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="overlay-header drag-handle header-minimal"
          onMouseDown={(e) => {
            draggingRef.current = true;
            dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            const onMove = (ev: MouseEvent) => {
              const width = panelRef.current?.offsetWidth || 360;
              const height = panelRef.current?.offsetHeight || 380;
              let x = ev.clientX - dragOffsetRef.current.x;
              let y = ev.clientY - dragOffsetRef.current.y;
              const maxX = window.innerWidth - width - 12;
              const maxY = window.innerHeight - height - 12;
              x = Math.max(12, Math.min(maxX, x));
              y = Math.max(12, Math.min(maxY, y));
              setPos({ x, y });
            };
            const onUp = () => {
              draggingRef.current = false;
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
            <div className="composer-header-controls">
              <div className="header-control">
              <button
                className={`header-icon-btn ${draft.dueDate || draft.dueTime ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowWhen((v) => !v);
                  setShowHorizon(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="When"
                title="When"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 3.5v3M17 3.5v3M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {showWhen && (
                <div className="composer-popover when-popover" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="popover-row">
                    <input
                      type="date"
                      className="mini-due"
                      value={draft.dueDate}
                      onChange={(e) => {
                        setDraft({ ...draft, dueDate: e.target.value, scheduleMode: 'date' });
                      }}
                    />
                    <input
                      type="time"
                      className="mini-time"
                      value={draft.dueTime}
                      onChange={(e) => setDraft({ ...draft, dueTime: e.target.value, scheduleMode: 'date' })}
                    />
                  </div>
                  <div className="popover-actions">
                    <button
                      className="ghost btn-compact"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, dueDate: '', dueTime: '', scheduleMode: 'date' }));
                        setShowWhen(false);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="header-control">
              <button
                className={`header-icon-btn ${draft.scheduleMode === 'horizon' ? `active horizon-${activeHorizon.id}` : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowHorizon((v) => !v);
                  setShowWhen(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Horizon"
                title="Horizon"
              >
                <span className={`horizon-dot horizon-${activeHorizon.id}`} />
              </button>
              {showHorizon && (
                <div className="composer-popover horizon-popover" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="horizon-segments">
                    {HORIZON_META.map((meta) => (
                      <button
                        key={meta.id}
                        className={`horizon-chip horizon-${meta.id} ${draft.horizon === meta.label ? 'active' : ''}`}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            horizon: meta.label,
                            scheduleMode: 'horizon',
                            dueDate: '',
                            dueTime: ''
                          });
                          setShowWhen(false);
                          setShowHorizon(false);
                        }}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              className="overlay-close"
              onClick={() => requestClose(true)}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div
          className="newtask-minimal"
          onKeyDown={(e) => {
            if (e.metaKey) {
              const key = e.key.toLowerCase();
              if (key === 'd') {
                e.preventDefault();
                setShowWhen(true);
                return;
              }
              if (key === 't') {
                e.preventDefault();
                setShowWhen(true);
                return;
              }
              if (key === 'h') {
                e.preventDefault();
                setShowHorizon(true);
                return;
              }
              if (key === 'enter' || key === 's') {
                e.preventDefault();
                commitCreate();
                return;
              }
            }
          }}
        >
          <input
            className="newtask-title"
            placeholder="Describe your task"
            value={draft.title}
            ref={titleRef}
            onChange={(e) => {
              setDraft({ ...draft, title: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (blocks.length === 0) {
                  const note = { id: crypto.randomUUID(), type: 'note' as const, text: '' };
                  setBlocks([note]);
                  focusBlock(note.id);
                } else {
                  focusBlock(blocks[0].id);
                }
              }
            }}
          />
          <div className="composer-workspace" ref={workspaceRef}>
            <div
              className={`workspace-placeholder ${
                blocks.some((b) => b.type === 'subtask' || b.text.trim().length > 0) ? 'hidden' : ''
              }`}
            >
              Press Enter to add details or subtasks
              <span>Type “- ” at the start of a line to add a subtask</span>
            </div>
            <div className="composer-blocks">
            {blocks.map((block, idx) => {
              if (block.type === 'note') {
                return (
                  <textarea
                    key={block.id}
                    className="note-block"
                    ref={(el) => { blockRefs.current[block.id] = el; }}
                    rows={1}
                    value={block.text}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, text: nextText } : b))
                      );
                      autosize(e.currentTarget);
                      if (tagHelperOpen && tagHelperBlock === block.id && tagHelperIndex !== null) {
                        const caret = e.currentTarget.selectionStart ?? nextText.length;
                        if (caret <= tagHelperIndex) {
                          closeTagHelper();
                          return;
                        }
                        const slice = nextText.slice(tagHelperIndex + 1, caret);
                        if (/\s/.test(slice)) {
                          closeTagHelper();
                          return;
                        }
                        setTagHelperQuery(slice);
                      }
                    }}
                    onKeyDown={(e) => {
                      const el = e.currentTarget;
                      const value = el.value;
                      const caret = el.selectionStart;
                      if (tagHelperOpen && tagHelperBlock === block.id) {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          closeTagHelper();
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const pick = tagSuggestions[0] ?? tagHelperQuery.trim();
                          if (pick) {
                            insertTag(pick);
                          } else {
                            closeTagHelper();
                          }
                          return;
                        }
                        if (e.key === 'Backspace') {
                          const caretPos = el.selectionStart ?? 0;
                          if (tagHelperIndex !== null && caretPos <= tagHelperIndex + 1 && tagHelperQuery.length === 0) {
                            closeTagHelper();
                          }
                        }
                      }
                      const lineStart = value.lastIndexOf('\n', Math.max(0, caret - 1)) + 1;
                      const lineEndRaw = value.indexOf('\n', caret);
                      const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
                      const line = value.slice(lineStart, lineEnd);
                      if (e.key === '#') {
                        if (caret !== null) {
                          setTagHelperOpen(true);
                          setTagHelperQuery('');
                          setTagHelperBlock(block.id);
                          setTagHelperIndex(caret);
                          updateTagHelperPosition(el);
                        }
                      }
                      if (e.key === 'Enter') {
                        const trimmed = line.replace(/^\s*/, '');
                        if (trimmed.startsWith('- ')) {
                          e.preventDefault();
                          const subText = trimmed.replace(/^-+\s*/, '').trim();
                          replaceLineWithSubtask(idx, lineStart, lineEnd, subText);
                          return;
                        }
                        const isEmptyLine = line.length === 0;
                        const prevIsBreak = lineStart > 0 && value[lineStart - 1] === '\n';
                        if (isEmptyLine && caret === lineStart && prevIsBreak) {
                          e.preventDefault();
                          const newBlock = { id: crypto.randomUUID(), type: 'note' as const, text: '' };
                          insertBlockAfter(idx, newBlock);
                        }
                      }
                      if (e.key === ' ') {
                        const trimmed = line.replace(/^\s*/, '');
                        const caretAtLineEnd = caret === lineStart + line.length;
                        if (trimmed === '-' && caretAtLineEnd) {
                          e.preventDefault();
                          replaceLineWithSubtask(idx, lineStart, lineEnd, '');
                        }
                      }
                    }}
                    onFocus={(e) => autosize(e.currentTarget)}
                  />
                );
              }
              return (
                <div key={block.id} className={`subtask-block ${block.done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={block.done}
                    onChange={(e) => {
                      setBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, done: e.target.checked } : b))
                      );
                    }}
                  />
                  <textarea
                    className="subtask-input"
                    ref={(el) => { blockRefs.current[block.id] = el; }}
                    rows={1}
                    value={block.text}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      if (nextText === '-' || nextText === '- ') {
                        replaceSubtaskWithNote(idx, '- ', 2);
                        return;
                      }
                      setBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, text: nextText } : b))
                      );
                      autosize(e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' && block.text === '-') {
                        e.preventDefault();
                        replaceSubtaskWithNote(idx, '- ', 2);
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (block.text.trim()) {
                          const newBlock = { id: crypto.randomUUID(), type: 'subtask' as const, text: '', done: false, fromDash: false };
                          insertBlockAfter(idx, newBlock);
                        } else {
                          replaceSubtaskWithNote(idx, '', 0);
                        }
                      }
                      if (e.key === 'Backspace' && !block.text) {
                        e.preventDefault();
                        replaceSubtaskWithNote(idx, block.fromDash ? '- ' : '', block.fromDash ? 2 : 0);
                      }
                    }}
                    onFocus={(e) => autosize(e.currentTarget)}
                  />
                </div>
              );
            })}
            </div>
            {tagHelperOpen && (
              <div
                className="tag-helper"
                style={{ left: tagHelperPos.x, top: tagHelperPos.y }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {tagSuggestions.length > 0 ? (
                  tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      className="tag-suggestion"
                      onClick={() => insertTag(tag)}
                    >
                      #{tag}
                    </button>
                  ))
                ) : (
                  <button
                    className="tag-suggestion"
                    onClick={() => insertTag(tagHelperQuery.trim() || 'tag')}
                  >
                    Create “{tagHelperQuery.trim() || 'tag'}”
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const PRESETS: Array<{ name: string; opacity: number; blur: number }> = [
  { name: 'Frosted', opacity: 0.35, blur: 8 },
  { name: 'Paper', opacity: 0.25, blur: 4 },
  { name: 'Charcoal', opacity: 0.4, blur: 10 },
  { name: 'Blueprint', opacity: 0.32, blur: 6 },
  { name: 'Clear', opacity: 0.18, blur: 2 }
];

const QuadrantCard = ({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { className: string }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoveringRef = useRef(false);
  const currentRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedMotionRef.current = mq.matches;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const applyTransform = () => {
    if (!ref.current) return;
    const baseLift = -1.5;
    ref.current.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y + baseLift}px, 0)`;
  };

  const animate = () => {
    if (!hoveringRef.current || reducedMotionRef.current) return;
    const lerp = 0.12;
    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * lerp;
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * lerp;
    applyTransform();
    rafRef.current = requestAnimationFrame(animate);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const max = 3;
    targetRef.current.x = x * max;
    targetRef.current.y = y * max;
  };

  const onPointerEnter = () => {
    if (reducedMotionRef.current) return;
    hoveringRef.current = true;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animate);
    }
  };

  const onPointerLeave = () => {
    hoveringRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (ref.current) {
      ref.current.style.transition = 'transform 240ms var(--ease)';
      ref.current.style.transform = 'translate3d(0, 0, 0)';
      window.setTimeout(() => {
        if (ref.current) {
          ref.current.style.transition = '';
          ref.current.style.transform = '';
        }
      }, 240);
    }
    currentRef.current = { x: 0, y: 0 };
    targetRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={ref}
      className={className}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      {children}
    </div>
  );
};

const HeaderBackgroundPanel = ({
  meta,
  setMeta,
  imageUrl,
  setImageUrl,
  anchor,
  isOpen,
  onClose,
  resolvedTheme
}: {
  meta: HeaderBgMeta;
  setMeta: React.Dispatch<React.SetStateAction<HeaderBgMeta>>;
  imageUrl: string | null;
  setImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  anchor: { x: number; y: number } | null;
  isOpen: boolean;
  onClose: () => void;
  resolvedTheme: 'light' | 'dark';
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (!anchor) return;
    const width = 360;
    const height = 360;
    let x = anchor.x + 12;
    let y = anchor.y + 12;
    const maxX = window.innerWidth - width - 16;
    const maxY = window.innerHeight - height - 16;
    x = Math.max(16, Math.min(maxX, x));
    y = Math.max(16, Math.min(maxY, y));
    setPos({ x, y });
  }, [anchor]);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!isOpen) return;
      if (!panelRef.current) return;
      if (draggingRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isOpen, onClose]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setMeta((prev) => ({
      ...prev,
      enabled: true,
      opacity: preset.opacity,
      blur: preset.blur,
      preset: preset.name,
      updatedAt: Date.now()
    }));
  };

  const onUpload = async (file: File) => {
    await BackgroundStorage.setHeaderImage(file);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const defaults = resolvedTheme === 'dark'
      ? { opacity: 0.35, blur: 10 }
      : { opacity: 0.35, blur: 6 };
    setMeta((prev) => ({
      ...prev,
      enabled: true,
      opacity: prev.opacity ?? defaults.opacity,
      blur: prev.blur ?? defaults.blur,
      preset: prev.preset || 'Frosted',
      updatedAt: Date.now()
    }));
  };

  const onReset = async () => {
    await BackgroundStorage.clearHeaderImage();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setMeta((prev) => ({
      ...prev,
      enabled: false,
      updatedAt: Date.now()
    }));
  };

  const originX = anchor ? anchor.x - pos.x : 20;
  const originY = anchor ? anchor.y - pos.y : 20;

  return createPortal(
    <div className="overlay-root">
      <div
        className={`overlay-panel utility-panel header-bg-panel ${isOpen ? 'open' : hasOpened ? 'closing' : 'closed'}`}
        ref={panelRef}
        style={{ left: pos.x, top: pos.y, transformOrigin: `${originX}px ${originY}px` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="overlay-header drag-handle"
          onMouseDown={(e) => {
            draggingRef.current = true;
            dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            const onMove = (ev: MouseEvent) => {
              const width = panelRef.current?.offsetWidth || 360;
              const height = panelRef.current?.offsetHeight || 320;
              let x = ev.clientX - dragOffsetRef.current.x;
              let y = ev.clientY - dragOffsetRef.current.y;
              const maxX = window.innerWidth - width - 12;
              const maxY = window.innerHeight - height - 12;
              x = Math.max(12, Math.min(maxX, x));
              y = Math.max(12, Math.min(maxY, y));
              setPos({ x, y });
            };
            const onUp = () => {
              draggingRef.current = false;
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
          <div className="overlay-title">Header Appearance</div>
          <button className="overlay-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="header-bg-controls">
          <div className="file-row">
            <label className="file-label">
              Upload image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
            </label>
            <button className="ghost" onClick={onReset} disabled={!imageUrl}>
              Reset
            </button>
          </div>
          <div className="slider-row">
            <label>
              Opacity
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={meta.opacity}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, enabled: true, opacity: Number(e.target.value), updatedAt: Date.now() }))
                }
              />
            </label>
            <label>
              Blur
              <input
                type="range"
                min={0}
                max={18}
                step={1}
                value={meta.blur}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, enabled: true, blur: Number(e.target.value), updatedAt: Date.now() }))
                }
              />
            </label>
          </div>
          <div className="preset-row">
            <div className="preset-label">Presets</div>
            <div className="preset-list">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`preset-chip ${meta.preset === p.name ? 'active' : ''}`}
                  onClick={() => applyPreset(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
