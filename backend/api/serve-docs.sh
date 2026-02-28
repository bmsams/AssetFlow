#!/bin/bash
# Script to serve API documentation locally
# Usage: ./serve-docs.sh [swagger|redoc|both]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-swagger}"

echo "🚀 Asset Management System API Documentation Server"
echo "=================================================="

# Check if Docker is available
if command -v docker &> /dev/null; then
    HAS_DOCKER=true
else
    HAS_DOCKER=false
fi

# Check if npx is available
if command -v npx &> /dev/null; then
    HAS_NPX=true
else
    HAS_NPX=false
fi

serve_with_docker() {
    echo "📦 Starting with Docker..."
    
    case "$MODE" in
        swagger)
            echo "🔵 Starting Swagger UI on http://localhost:8080"
            docker-compose up swagger-ui
            ;;
        redoc)
            echo "🔴 Starting Redoc on http://localhost:8081"
            docker-compose up redoc
            ;;
        both)
            echo "🔵 Starting Swagger UI on http://localhost:8080"
            echo "🔴 Starting Redoc on http://localhost:8081"
            docker-compose up
            ;;
        *)
            echo "Unknown mode: $MODE"
            echo "Usage: $0 [swagger|redoc|both]"
            exit 1
            ;;
    esac
}

serve_with_npx() {
    echo "📦 Starting with npx..."
    
    case "$MODE" in
        swagger)
            echo "🔵 Starting Swagger UI on http://localhost:8080"
            echo "   Press Ctrl+C to stop"
            npx @redocly/cli preview-docs openapi.yaml --port 8080
            ;;
        redoc)
            echo "🔴 Starting Redoc preview on http://localhost:8081"
            echo "   Press Ctrl+C to stop"
            npx @redocly/cli preview-docs openapi.yaml --port 8081
            ;;
        *)
            echo "Note: 'both' mode requires Docker"
            echo "Starting Redoc preview on http://localhost:8080"
            npx @redocly/cli preview-docs openapi.yaml --port 8080
            ;;
    esac
}

serve_static() {
    echo "📦 Starting static file server..."
    echo "🔵 Opening Swagger UI at http://localhost:8080/swagger-ui/"
    
    # Use Python's built-in HTTP server
    if command -v python3 &> /dev/null; then
        echo "   Press Ctrl+C to stop"
        python3 -m http.server 8080
    elif command -v python &> /dev/null; then
        echo "   Press Ctrl+C to stop"
        python -m http.server 8080
    else
        echo "❌ No suitable server found. Please install Docker, Node.js, or Python."
        exit 1
    fi
}

# Main logic
if [ "$HAS_DOCKER" = true ]; then
    serve_with_docker
elif [ "$HAS_NPX" = true ]; then
    serve_with_npx
else
    serve_static
fi
