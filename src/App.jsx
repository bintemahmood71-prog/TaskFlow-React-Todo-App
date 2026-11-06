import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "taskflow-tasks";
const SOUND_KEY = "taskflow-sound";

const todayString = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const readSavedTasks = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const formatDate = (value) => {
  if (!value) return "No due date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
};

const priorityOrder = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function App() {
  const [tasks, setTasks] = useState(readSavedTasks);

  const [page, setPage] = useState("dashboard");

  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "false"
  );

  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const titleInputRef = useRef(null);

  // Task form states
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("Study");
  const [dueDate, setDueDate] = useState("");
  const [editId, setEditId] = useState(null);

  // Search, filter and sorting states
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  // Save tasks automatically
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem(SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  // Clean up notification timer
  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // Display temporary notifications
  const showToast = (message, type = "success") => {
    setToast({ message, type });

    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  // Generate sound effects using browser audio
  const playSound = (type = "success") => {
    if (!soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      const tones = {
        success: [620, 780],
        complete: [660, 880],
        delete: [300, 190],
        error: [190, 150],
        click: [460],
      };

      const notes = tones[type] || tones.click;

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        notes[0],
        context.currentTime
      );

      if (notes[1]) {
        oscillator.frequency.setValueAtTime(
          notes[1],
          context.currentTime + 0.09
        );
      }

      gain.gain.setValueAtTime(
        0.0001,
        context.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.10,
        context.currentTime + 0.02
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.22
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.23);

      oscillator.onended = () => context.close();
    } catch {
      // The app remains usable if browser audio is unavailable.
    }
  };

  // Reset task form
  const resetForm = () => {
    setInput("");
    setPriority("Medium");
    setCategory("Study");
    setDueDate("");
    setEditId(null);
  };

  // Add or update a task
  const handleSubmit = (event) => {
    event.preventDefault();

    const cleanTitle = input.trim();

    if (!cleanTitle) {
      showToast("Please enter a task title first.", "error");
      playSound("error");
      titleInputRef.current?.focus();
      return;
    }

    if (editId !== null) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editId
            ? {
                ...task,
                text: cleanTitle,
                priority,
                category,
                dueDate,
              }
            : task
        )
      );

      showToast("Your task has been updated.", "success");
      playSound("success");
    } else {
      const newTask = {
        id: `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        text: cleanTitle,
        priority,
        category,
        dueDate,
        completed: false,
        createdAt: Date.now(),
      };

      setTasks((current) => [newTask, ...current]);

      showToast(
        "Task added successfully. Keep it up!",
        "success"
      );

      playSound("success");
    }

    resetForm();
  };

  // Load task details into the form for editing
  const editTask = (task) => {
    setInput(task.text);
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(task.dueDate || "");
    setEditId(task.id);

    setPage("tasks");

    window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 80);
  };

  // Delete a task
  const deleteTask = (id) => {
    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );

    if (editId === id) {
      resetForm();
    }

    showToast("Task deleted.", "info");
    playSound("delete");
  };

  // Complete or reactivate a task
  const toggleComplete = (id) => {
    const selectedTask = tasks.find(
      (task) => task.id === id
    );

    if (!selectedTask) return;

    const completing = !selectedTask.completed;

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, completed: completing }
          : task
      )
    );

    showToast(
      completing
        ? "Well done! Task completed."
        : "Task moved back to active.",
      completing ? "success" : "info"
    );

    playSound(completing ? "complete" : "click");
  };

  // Remove all completed tasks
  const clearCompleted = () => {
    const completedCount = tasks.filter(
      (task) => task.completed
    ).length;

    if (!completedCount) {
      showToast(
        "You have no completed tasks to clear.",
        "info"
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${completedCount} completed task(s)?`
    );

    if (!confirmed) return;

    if (
      editId &&
      tasks.some(
        (task) =>
          task.id === editId && task.completed
      )
    ) {
      resetForm();
    }

    setTasks((current) =>
      current.filter((task) => !task.completed)
    );

    showToast("Completed tasks cleared.", "success");
    playSound("success");
  };

  // Dashboard calculations
  const today = todayString();

  const completed = tasks.filter(
    (task) => task.completed
  ).length;

  const pending = tasks.length - completed;

  const overdue = tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate &&
      task.dueDate < today
  ).length;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
// Search, filter and sort tasks
const visibleTasks = useMemo(() => {
  let result = [...tasks];

  if (search.trim()) {
    const query = search.trim().toLowerCase();

    result = result.filter((task) => {
      const searchableText = [
        task.text || "",
        task.category || "",
        task.priority || "",
        task.dueDate || "",
        task.dueDate ? formatDate(task.dueDate) : "no due date",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }

  if (filter === "Active") {
    result = result.filter((task) => !task.completed);
  }

  if (filter === "Completed") {
    result = result.filter((task) => task.completed);
  }

  if (categoryFilter !== "All") {
    result = result.filter(
      (task) => task.category === categoryFilter
    );
  }

  if (sortBy === "priority") {
    result.sort(
      (a, b) =>
        priorityOrder[a.priority] -
        priorityOrder[b.priority]
    );
  } else if (sortBy === "dueDate") {
    result.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    result.sort((a, b) => b.createdAt - a.createdAt);
  }

  return result;
}, [
  tasks,
  search,
  filter,
  categoryFilter,
  sortBy,
]);
      
  // Recent tasks for dashboard
  const recentTasks = [...tasks]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);

  // Navigate to My Tasks
  const openTasksPage = () => {
    setPage("tasks");
    setFilter("All");
    setCategoryFilter("All");
  };

  // Reusable task card
  const TaskCard = ({ task }) => {
    const isOverdue =
      !task.completed &&
      task.dueDate &&
      task.dueDate < today;

    return (
      <article
        className={`task-card ${
          task.completed ? "is-completed" : ""
        }`}
      >
        <button
          className={`task-check ${
            task.completed ? "checked" : ""
          }`}
          onClick={() => toggleComplete(task.id)}
          aria-label={
            task.completed
              ? "Mark task active"
              : "Complete task"
          }
          title={
            task.completed
              ? "Mark active"
              : "Mark complete"
          }
        >
          {task.completed ? "✓" : ""}
        </button>

        <div className="task-content">
          <div className="task-title-line">
            <h3>{task.text}</h3>

            {task.completed && (
              <span className="completed-label">
                Completed
              </span>
            )}
          </div>

          <div className="task-meta">
            <span
              className={`category-chip category-${task.category.toLowerCase()}`}
            >
              {task.category}
            </span>

            <span
              className={`priority-chip priority-${task.priority.toLowerCase()}`}
            >
              {task.priority} priority
            </span>

            <span
              className={`due-label ${
                isOverdue ? "overdue" : ""
              }`}
            >
              {task.dueDate
                ? `${
                    isOverdue ? "Overdue · " : "Due · "
                  }${formatDate(task.dueDate)}`
                : "No due date"}
            </span>
          </div>
        </div>

        <div className="task-actions">
          <button
            className="icon-action edit-action"
            onClick={() => editTask(task)}
            title="Edit task"
            aria-label="Edit task"
          >
            ✎
          </button>

          <button
            className="icon-action delete-action"
            onClick={() => deleteTask(task.id)}
            title="Delete task"
            aria-label="Delete task"
          >
            ×
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setPage("dashboard")}
          aria-label="Go to dashboard"
        >
          <span className="brand-mark">T</span>

          <span>
            Task<span className="brand-light">Flow</span>
          </span>
        </button>

        <div className="sidebar-label">
          WORKSPACE
        </div>

        <nav
          className="side-nav"
          aria-label="Main navigation"
        >
          <button
            className={`side-link ${
              page === "dashboard" ? "active" : ""
            }`}
            onClick={() => setPage("dashboard")}
          >
            <span className="nav-icon">▦</span>
            Dashboard
          </button>

          <button
            className={`side-link ${
              page === "tasks" ? "active" : ""
            }`}
            onClick={openTasksPage}
          >
            <span className="nav-icon">☷</span>
            My Tasks
            <span className="nav-count">{pending}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">

  {/* Clickable workspace profile */}
  <button
    type="button"
    className="sidebar-profile"
    onClick={() => {
      setPage("dashboard");
      setSearch("");
      setFilter("All");
      setCategoryFilter("All");
    }}
    aria-label="Go to My Workspace dashboard"
    title="Go to My Workspace"
  >
    <div className="avatar">A</div>

    <div>
      <strong>My Workspace</strong>
      <span>Personal planner</span>
    </div>

    <span className="profile-dots">•••</span>
  </button>
</div>
      </aside>

      {/* Main application */}
      <main className="main-area">
        {/* Header */}
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>

            <strong>
              {page === "dashboard"
                ? "Dashboard"
                : "My Tasks"}
            </strong>
          </div>

          <div className="topbar-actions">
            {/* Search */}
            <label className="header-search">
              <span>⌕</span>

              
            </label>

            {/* Sound toggle */}
            <button
              className={`sound-button ${
                soundEnabled ? "sound-on" : ""
              }`}
              onClick={() => {
                setSoundEnabled((enabled) => !enabled);

                showToast(
                  soundEnabled
                    ? "Sounds turned off."
                    : "Sounds turned on.",
                  "info"
                );
              }}
              title={
                soundEnabled
                  ? "Mute sound effects"
                  : "Enable sound effects"
              }
            >
              <span>{soundEnabled ? "♫" : "♪"}</span>

              <span className="sound-text">
                {soundEnabled ? "Sound on" : "Muted"}
              </span>
            </button>

            {/* Quick add button */}
            <button
              className="header-add-button"
              onClick={() => {
                setPage("tasks");
                resetForm();

                window.setTimeout(() => {
                  titleInputRef.current?.focus();
                }, 80);
              }}
            >
              <span>＋</span>
              New task
            </button>
          </div>
        </header>

        <div className="page-content">
          {page === "dashboard" ? (
            /* DASHBOARD PAGE */
            <section className="dashboard-page">
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">
                    YOUR PRODUCTIVITY SPACE
                  </p>

                  <h1>
                    Good to see you{" "}
                    <span className="wave">✦</span>
                  </h1>

                  <p className="page-subtitle">
                    A little progress each day adds up
                    to big results.
                  </p>
                </div>

                <div className="date-pill">
                  <span>▣</span>

                  {new Date().toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }
                  )}
                </div>
              </div>

              {/* Statistics */}
              <div className="stats-grid">
                <div className="stat-card stat-total">
                  <div className="stat-top">
                    <span>Total tasks</span>
                    <span className="stat-icon">▤</span>
                  </div>

                  <strong>{tasks.length}</strong>
                  <small>All your tasks</small>
                </div>

                <div className="stat-card stat-done">
                  <div className="stat-top">
                    <span>Completed</span>
                    <span className="stat-icon">✓</span>
                  </div>

                  <strong>{completed}</strong>
                  <small>Tasks finished</small>
                </div>

                <div className="stat-card stat-pending">
                  <div className="stat-top">
                    <span>Pending</span>
                    <span className="stat-icon">◷</span>
                  </div>

                  <strong>{pending}</strong>
                  <small>Still in progress</small>
                </div>

                <div className="stat-card stat-overdue">
                  <div className="stat-top">
                    <span>Overdue</span>
                    <span className="stat-icon">!</span>
                  </div>

                  <strong>{overdue}</strong>
                  <small>Need your attention</small>
                </div>
              </div>

              {/* Progress */}
              <section className="progress-panel">
                <div className="progress-heading">
                  <div>
                    <p className="eyebrow">
                      YOUR OVERVIEW
                    </p>

                    <h2>Task completion</h2>
                  </div>

                  <strong>{progress}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="progress-foot">
                  <span>
                    {completed} of {tasks.length} tasks
                    completed
                  </span>

                  <span>
                    {tasks.length
                      ? `${pending} remaining`
                      : "Add a task to get started"}
                  </span>
                </div>
              </section>

              {/* Recently added tasks */}
              <section className="recent-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      STAY ON TRACK
                    </p>

                    <h2>Recently added</h2>
                  </div>

                  <button
                    className="text-link"
                    onClick={openTasksPage}
                  >
                    View all tasks <span>→</span>
                  </button>
                </div>

                {recentTasks.length ? (
                  <div className="task-list">
                    {recentTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state dashboard-empty">
                    <div className="empty-illustration">
                      ✦
                    </div>

                    <h3>Your workspace is ready</h3>

                    <p>
                      Add your first task and start
                      building momentum.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() => setPage("tasks")}
                    >
                      Create your first task <span>→</span>
                    </button>
                  </div>
                )}
              </section>
            </section>
          ) : (
            /* MY TASKS PAGE */
            <section className="tasks-page">
              <div className="page-heading-row">
                <div>
                  <p className="eyebrow">
                    YOUR WORKSPACE
                  </p>

                  <h1>My Tasks</h1>

                  <p className="page-subtitle">
                    Organize your day, set priorities,
                    and get things done.
                  </p>
                </div>

                <div className="task-count-pill">
                  {tasks.length} total tasks
                </div>
              </div>

              {/* Task form */}
              <section className="task-form-panel">
                <div className="form-heading">
                  <div className="form-icon">
                    {editId ? "✎" : "＋"}
                  </div>

                  <div>
                    <h2>
                      {editId
                        ? "Update your task"
                        : "Create a new task"}
                    </h2>

                    <p>
                      {editId
                        ? "Make changes to your task details."
                        : "Add the details and keep your plans organized."}
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="task-form"
                >
                  <div className="form-field title-field">
                    <label htmlFor="task-title">
                      Task title
                    </label>

                    <input
                      id="task-title"
                      ref={titleInputRef}
                      type="text"
                      placeholder="e.g. Complete database assignment"
                      value={input}
                      onChange={(event) =>
                        setInput(event.target.value)
                      }
                      maxLength={100}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="task-category">
                        Category
                      </label>

                      <select
                        id="task-category"
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value)
                        }
                      >
                        <option>Study</option>
                        <option>Work</option>
                        <option>Personal</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="task-priority">
                        Priority
                      </label>

                      <select
                        id="task-priority"
                        value={priority}
                        onChange={(event) =>
                          setPriority(event.target.value)
                        }
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="task-date">
                        Due date
                      </label>

                      <input
                        id="task-date"
                        type="date"
                        value={dueDate}
                        onChange={(event) =>
                          setDueDate(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    {editId && (
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={resetForm}
                      >
                        Cancel edit
                      </button>
                    )}

                    <button
                      type="submit"
                      className="primary-button"
                    >
                      {editId ? "Save changes" : "Add task"}
                      <span>{editId ? "✓" : "＋"}</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Task manager */}
              <section className="task-manager">
                <div className="section-heading task-manager-heading">
                  <div>
                    <p className="eyebrow">YOUR LIST</p>

                    <h2>
                      All tasks{" "}
                      <span className="heading-count">
                        {visibleTasks.length}
                      </span>
                    </h2>
                  </div>

                  <button
                    className="clear-button"
                    onClick={clearCompleted}
                  >
                    Clear completed
                  </button>
                </div>

                {/* Filters and sorting */}
                <div className="task-toolbar">
                  <div
                    className="filter-tabs"
                    role="group"
                    aria-label="Filter tasks"
                  >
                    {["All", "Active", "Completed"].map(
                      (option) => (
                        <button
                          key={option}
                          className={`filter-tab ${
                            filter === option
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => setFilter(option)}
                        >
                          {option}

                          {option === "All" && (
                            <span>{tasks.length}</span>
                          )}
                        </button>
                      )
                    )}
                  </div>

                  <div className="toolbar-selects">
                    <select
                      aria-label="Filter by category"
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(event.target.value)
                      }
                    >
                      <option value="All">
                        All categories
                      </option>
                      <option>Study</option>
                      <option>Work</option>
                      <option>Personal</option>
                      <option>Other</option>
                    </select>

                    <select
                      aria-label="Sort tasks"
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(event.target.value)
                      }
                    >
                      <option value="newest">
                        Newest first
                      </option>
                      <option value="priority">
                        Priority
                      </option>
                      <option value="dueDate">
                        Due date
                      </option>
                    </select>
                  </div>
                </div>

                {/* Task list */}
                {visibleTasks.length ? (
                  <div className="task-list">
                    {visibleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      ⌕
                    </div>

                    <h3>
                      {search ||
                      filter !== "All" ||
                      categoryFilter !== "All"
                        ? "No matching tasks"
                        : "No tasks yet"}
                    </h3>

                    <p>
                      {search ||
                      filter !== "All" ||
                      categoryFilter !== "All"
                        ? "Try changing your search or filters."
                        : "Add a task above and it will appear here."}
                    </p>

                    {(search ||
                      filter !== "All" ||
                      categoryFilter !== "All") && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setSearch("");
                          setFilter("All");
                          setCategoryFilter("All");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </section>
            </section>
          )}
        </div>
      </main>

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <span className="toast-symbol">
            {toast.type === "success"
              ? "✓"
              : toast.type === "error"
              ? "!"
              : "i"}
          </span>

          {toast.message}

          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;