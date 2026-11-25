// Fitness Coaching App - basic REST API
// Run: npm install express, then node basic_app.js

const express = require("express");
const app = express();
app.use(express.json());

// data stored in memory
let plans = [];
let logs = [];

// 1. Create a workout plan
app.post("/api/v1/workout-plans", (req, res) => {
  const { clientId, title, goal, weeks } = req.body;

  // validation
  if (!clientId || !title || !goal || !weeks) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "clientId, title, goal and weeks are required",
    });
  }
  if (weeks < 1 || weeks > 52) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "weeks must be between 1 and 52",
    });
  }

  const plan = { id: plans.length + 1, clientId, title, goal, weeks };
  plans.push(plan);
  res.status(201).json(plan);
});

// 2. Get a workout plan by id
app.get("/api/v1/workout-plans/:id", (req, res) => {
  const plan = plans.find((p) => p.id == req.params.id);

  if (!plan) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: "Workout plan not found",
    });
  }
  res.status(200).json(plan);
});

// 3. Log a completed workout
app.post("/api/v1/workout-logs", (req, res) => {
  const { clientId, planId, date, exercise, sets, reps, weightKg } = req.body;

  // validation
  if (!clientId || !planId || !date || !exercise) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "clientId, planId, date and exercise are required",
    });
  }
  if (sets < 1 || reps < 1 || weightKg < 0) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "sets and reps must be at least 1 and weightKg cannot be negative",
    });
  }

  const log = { id: logs.length + 1, clientId, planId, date, exercise, sets, reps, weightKg };
  logs.push(log);
  res.status(201).json(log);
});

// 4. Get progress summary of a client
app.get("/api/v1/clients/:clientId/progress", (req, res) => {
  const clientLogs = logs.filter((l) => l.clientId == req.params.clientId);

  let totalVolume = 0;
  clientLogs.forEach((l) => {
    totalVolume += l.sets * l.reps * l.weightKg;
  });

  res.status(200).json({
    clientId: req.params.clientId,
    totalWorkouts: clientLogs.length,
    totalVolumeKg: totalVolume,
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});