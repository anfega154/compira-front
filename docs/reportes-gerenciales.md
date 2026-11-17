# Reportes gerenciales y PDF — COMPIRA

## Uso y alcance
En **Reportes**, configure periodo (por creación, vencimiento o cierre), equipo, responsable —incluido Sin responsable— y estado. Pulse **Generar informe** y luego **Exportar PDF**. Se genera inicialmente un corte sin filtros. Cambiar filtros bloquea exportar hasta generar nuevamente. Buscar/paginar el inventario no recorta el PDF.

Administrador consulta toda la organización. Coordinador consulta únicamente los equipos que coordina actualmente; no las tareas que creó en el pasado. Colaborador no accede a reportes. El servidor aplica estas restricciones, no depende del filtro visual.

## Contenido para gerencia
Control de corte con identificador, fecha, zona, autor y filtros; resumen y acciones sugeridas basadas en datos; avance y puntualidad; distribución de estados; calidad de datos; desgloses por equipo/responsable; cohortes mensuales; priorización explícita de hasta30 alertas y anexo con **todas** las tareas seleccionadas. Incluye observaciones contadas y última actividad, no el texto de observaciones ni descripciones.

No se inventan indicadores financieros, capacidad laboral, calidad de entregables ni metas/SLA que el sistema no registra. No hay una certificación universal para un informe gerencial. La vista HTML es la alternativa accesible; el PDF tiene texto seleccionable Unicode, título, idioma, marcadores, folios y encabezados de tabla repetidos, sin declarar PDF/UA ni PDF/A.

## Definiciones y consistencia
- Avance = (COMPLETED+CLOSED)/(total−CANCELLED). COMPLETED está pendiente de aprobación; no es cierre.
- Puntualidad = cierres a tiempo/cierres evaluables. Un cierre evaluable requiere estado CLOSED, evento CLOSED en historial, creación y vencimiento; el cierre no puede ser anterior a la creación. Se utiliza el último evento CLOSED, **nunca updatedAt**. Una observación posterior no altera puntualidad ni duración.
- Sin denominador: **N/D**, no0%. Promedio y mediana usan duraciones por tarea en horas calendario, no horas de trabajo ni promedios de promedios.
- Vencidas: activas con vencimiento ≤corte. Próximas: activas con corte<vencimiento≤corte+24h. Canceladas/completadas/cerradas no son activas.
- Tareas sin responsable o sin equipo permanecen incluidas y agrupadas. Los desgloses concilian con el total. Controles de calidad pueden coincidir, no se suman como tareas únicas.
- El periodo es inclusivo en la zona de la organización (UTC si no está configurada). Selecciona una cohorte de tareas; estados/asignaciones son actuales. **No reconstruye el pasado**, ni representa todo el flujo histórico fuera de la selección.
- Creaciones y cierres por mes corresponden sólo a tareas seleccionadas y zona del corte. Identificador de corte no equivale a firma ni registro inmutable.

## Contrato API aditivo
`GET /api/v1/tasks/reports/executive` — Bearer válido y cuenta activa de administrador/coordinador. `Cache-Control: no-store`.

| Parámetro | Contrato |
|---|---|
|from, to|Opcionales, YYYY-MM-DD inclusivos;1900-01-01 a9998-12-31; from≤to|
|dateBasis|CREATED (predeterminado), DUE, CLOSED|
|teamId, responsibleId|UUID opcionales, siempre dentro del alcance del actor|
|unassigned|true/false; excluyente con responsibleId|
|status|PENDING,IN_PROGRESS,DELAYED,COMPLETED,CLOSED,CANCELLED|

Desconocidos/repetidos/formatos inválidos →400. Sin autenticación →401; rol no autorizado →403. Conjunto vacío →200 con detalle vacío y métricas N/D pertinentes. Más de5000 tareas **después de filtrar** →400 REPORT_LIMIT_EXCEEDED, sin truncar. Consulta>30s →503 REPORT_TIMEOUT. Cliente cancela a35s, valida contrato y permite reintentar. Opciones de filtros se obtienen de equipos e indicadores acotados, no del directorio administrador `/users`.

Respuesta version1.0: metadatos; filtros aplicados; summary; quality; teams; assignees; distribution; monthlyCohorts; findings; recommendations; tasks. Contrato ejecutable documentado en OpenAPI por ExecutiveReportRouter y probado en ExecutiveReportHandlerTest. APIs anteriores mantienen campos y añaden denominadores evaluables.

## Implementación, privacidad y operación
Consulta SQL de lectura única con parámetros enlazados, perfil/equipo actual y agregado de historial; filtros antes del límite. No requiere migraciones ni recursos AWS adicionales. Una generación manual consulta el servidor; exportar reutiliza exactamente el JSON del corte. No son consultas periódicas nuevas.

PDF generado localmente con jsPDF/AutoTable y fuentes NotoSans empacadas con licencia OFL. Carga diferida; no se envían datos a terceros ni se almacena el PDF en AWS. Archivo incluye datos personales de responsables: distribución y retención según política de la organización. No se incluyen tokens/credenciales. Exportar no regenera el corte. Error/cancelación no produce un archivo parcial.

## Verificación y límites de evidencia
- Backend: pruebas unitarias, HTTP de parámetros/errores/timeout y seguridad de roles; PostgreSQL17 Testcontainers con migraciones reales valida alcance actual, filtros antes del límite, fechas por zona, historial vs última actividad y ausencia de duplicados.
- Frontend: pruebas de contrato/formulario/PDF real, fuentes locales, corte vacío, búsqueda vs exportación completa, paginación y anexo largo; suite y umbrales de cobertura existentes sin reducir.
- Integración Chrome con Postman local: ambos roles,1440/390/320px, descarga real, filtros pendientes,503 y ausencia de `/users`. Es evidencia **simulada**, no una prueba de Cognito ni de datos reales AWS. Artefactos locales en `/tmp/compira-executive-reports-audit`.
- Auditoría PDF: renderizar todas las páginas y revisar alineación/encabezados/tablas; texto extraíble y metadatos. No se afirma conformidad certificada de accesibilidad.

## Promoción y reversión
PR feature→dev en cada repositorio con CI verde; luego PR dev→qa. Desplegar primero backend compatible y después frontend. El pipeline QA publica AWS y verifica la revisión. Sin Terraform apply ni apertura de RDS.

Para revertir, preferir PR de reversión del frontend y después backend, o desplegar artefactos QA anteriores verificados siguiendo el procedimiento de despliegue. No borrar historia ni forzar ramas. La función no escribe datos de negocio; no existe rollback de esquema. La corrección de métricas puede cambiar porcentajes anteriores porque deja de asumir cierres a partir de actualizaciones.
