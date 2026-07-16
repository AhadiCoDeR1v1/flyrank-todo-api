# FlyRank Todo CRUD API (Express & Node.js)

A lightweight, robust in-memory RESTful Task Management API built with Node.js and Express. Exposes endpoints for a full Create, Read, Update, and Delete (CRUD) lifecycle with input validation, explicit error status codes, and interactive Swagger UI documentation.

## Features & Endpoints
* **In-Memory Storage:** Performs high-performance manipulations on active arrays (no database required).
* **Robust Validation:** Implements backend business rules, preventing empty title assignments (returns `400 Bad Request`).
* **Interactive UI:** Serves dynamic documentation via Swagger UI at the `/docs` path.

### Endpoint Registry
| Method | Path | Summary | Expected Success | Expected Errors |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | Fetch service description | `200 OK` | - |
| **GET** | `/health` | Live diagnostic health check | `200 OK` | - |
| **GET** | `/tasks` | Retrieve all current tasks | `200 OK` | - |
| **GET** | `/tasks/:id` | Fetch specific task by ID | `200 OK` | `404 Not Found` |
| **POST** | `/tasks` | Create a new validated task | `201 Created` | `400 Bad Request` |
| **PUT** | `/tasks/:id` | Replace / Update task fields | `200 OK` | `400 Bad Request`, `404 Not Found` |
| **DELETE**| `/tasks/:id` | Wipe task from memory | `204 No Content` | `404 Not Found` |

---

## Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (version 16+ recommended).

### 2. Installation & Run Commands
Clone the repository, download dependencies, and start the local server:
```bash
# Install required dependencies
npm install

# Start the active server instance on port 3000
node server.js