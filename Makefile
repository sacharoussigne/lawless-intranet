.PHONY:help network bash start stop restart status logs build rebuild pull push remove dockerfile deploy service docker-prune docker-df
.DEFAULT_GOAL=help

CYAN   = \033[0;36m
NC     = \033[m
ENV   ?= dev
LARAVEL_VERSION ?= ^10

-include .env

help:
	@grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.env:
	@[ -f .env ] || cp build/.env.tpl .env; 

network:
	@docker network inspect proxy > /dev/null || docker network create proxy
	@docker network inspect db > /dev/null || docker network create db

start: .env network .env ## Démarrage des conteneurs
	@[ -d ~/.npm ] || mkdir ~/.npm
	@docker compose up -d --remove-orphans

start-clean: .env network .env ## Démarrage des conteneurs
	@[ -d ~/.npm ] || mkdir ~/.npm
	@docker compose up -d --remove-orphans --build --force-recreate

stop: ## Arrêt des conteneurs
	@docker compose down --remove-orphans

restart: stop start ## Redémarrage des conteneurs

authbash: ## Accéder au conteneur auth en bash
	@docker compose exec -u root auth sh

dispensarybash: ## Accéder au conteneur auth en bash
	@docker compose exec -u root dispensary sh

documentsbash: ## Accéder au conteneur auth en bash
	@docker compose exec -u root documents sh

exec: ## Exécuter une commande dans le conteneur (make exec COMMAND="...")
	@docker compose exec -T -u root web sh -c "$(COMMAND)"

status: ## Status des conteneurs
	@docker compose ps

logs: ## Affichage des logs des conteneurs
	@docker compose logs

build: .env ## Build du conteneur
	@docker compose build

build-no-cache: .env ## Build du conteneur (sans utilisation du cache)
	@docker compose build --no-cache

rebuild: network stop build-no-cache start ## Rebuild TOTAL sans cache - dépannage uniquement
	
remove: ## Suppression des conteneurs
	@docker compose down --rmi all -v --remove-orphans

deploy: network ## Build avec cache puis déploiement
	@docker compose up -d --build --remove-orphans

service: network ## Déploiement d'un seul service (make service SERVICE=dispensary)
	@test -n "$(SERVICE)" || (echo "Usage: make service SERVICE=dispensary" && exit 1)
	@docker compose up -d --build --remove-orphans $(SERVICE)

docker-prune: ## Purge le cache de build Docker
	@docker buildx prune -a -f

docker-df: ## Affiche l'utilisation disque Docker
	@docker system df
	@docker buildx du 2>/dev/null | tail -3 || true