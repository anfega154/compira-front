# Compira Front

Proyecto base frontend con:

- React 19
- TypeScript
- Vite
- React Router

La pantalla inicial muestra las tareas según el rol:

- Administrador y Coordinador: tareas del equipo.
- Colaborador: tareas asignadas.

COMPIRA administra una única organización por despliegue; no incluye registro ni listado de empresas.

## Configuración

Crear el archivo `.env` a partir de:

```bash
cp .env.example .env
```

Valor por defecto:

```bash
VITE_API_URL=http://localhost:8080/api/v1
```

## Ejecutar en desarrollo

Desde `/Users/andresganan/Desktop/COMPIRA/compira-front`:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Repositorio remoto

Este proyecto quedó conectado a:

- [anfega154/compira-front](https://github.com/anfega154/compira-front)
