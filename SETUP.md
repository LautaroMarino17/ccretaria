# SecretarIA - Guía de Setup

## 1. Firebase (5 minutos)

1. Ir a https://console.firebase.google.com
2. Crear proyecto: `secretaria-app`
3. Desactivar Google Analytics
4. **Authentication** → Sign-in method → Habilitar Email/Password
5. **Firestore** → Crear base de datos → Modo producción
6. **Project Settings** → Web → Registrar app → Copiar config
7. **Project Settings** → Service accounts → Generate new private key → Guardar como `backend/firebase-adminsdk.json`

## 2. Backend Python

```bash
cd backend
python -m venv venv
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# Configurar variables
cp .env.example .env
# Editar .env con tus valores

# Asegurarse de tener Ollama corriendo con llama3:
# ollama run llama3

uvicorn main:app --reload
# API en http://localhost:8000
# Docs en http://localhost:8000/docs
```

## 3. Frontend Angular

```bash
cd frontend

# Pegar la config de Firebase en:
# src/environments/environment.ts

npm install
ng serve
# App en http://localhost:4200
```

## 4. Flujo de uso

### Profesional
1. Registrarse con rol "Profesional"
2. Agregar pacientes
3. En el detalle del paciente → "Nueva consulta" → grabar audio
4. Al detener: Whisper transcribe → llama3 estructura
5. Revisar y confirmar → se guarda en Firestore
6. Generar plan de rutina para el paciente
7. Gestionar turnos y enviar recordatorios

### Paciente
1. Registrarse con rol "Paciente"
2. Ver historias clínicas (generadas por el profesional)
3. Ver plan de rutina personalizado
4. Ver y confirmar/cancelar turnos

## 5. Deploy a Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools
firebase login

# Build de producción
cd frontend
ng build --configuration production

# Deploy
cd ..
firebase deploy --only hosting
```

## Estructura Firestore

```
professionals/{professionalId}/
  patients/{patientId}/
    - nombre, apellido, dni, ...
    clinical_histories/{historyId}/
      - motivo_consulta, diagnostico, ...
    routines/{routineId}/
      - titulo, actividades, ...
  appointments/{appointmentId}/
    - patient_name, appointment_datetime, status, ...
```
