#!/bin/bash

# Example .env generator
sed 's/=.*/=/' ./src/.env.production > ./src/.env.production.example
sed 's/=.*/=/' ./src/.env.development > ./src/.env.development.example