# Run Backend:

`cd backend`

`docker build -t pdf-inspector-backend .`

`docker run --rm -p 1339:1339 pdf-inspector-backend`


# Run Frontend:

`cd frontend`

`python -m http.server 8080`