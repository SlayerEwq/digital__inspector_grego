# Run Backend:

`cd digital__inspector_grego/backend`

`docker build --no-cache -t pdf-inspector-backend .`

`docker run --rm -p 1339:1339 pdf-inspector-backend`


# Run Frontend:

`cd digital__inspector_grego/frontend`

`python -m http.server 8080`