import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-layout">
      <div class="legal-card">
        <a routerLink="/login" class="back-link">← Volver</a>
        <h1>Política de Privacidad de SecretarIA</h1>
        <p class="meta">Versión vigente: <strong>{{ version }}</strong> — Última actualización: {{ version }}</p>

        <p class="lead">
          Esta política explica qué datos personales y de salud recolecta SecretarIA, con qué finalidad,
          a qué terceros se los transfiere (incluyendo transferencias internacionales) y qué derechos tenés
          sobre tus datos, en cumplimiento de la Ley 25.326 de Protección de los Datos Personales y la
          Ley 26.529 de Derechos del Paciente (Argentina).
        </p>

        <h2>1. Alcance y roles</h2>
        <p>
          SecretarIA es una plataforma de uso exclusivamente profesional: los usuarios que se registran y
          contratan el servicio son <strong>profesionales de la salud</strong>, quienes cargan datos de sus
          propios pacientes para gestionar historias clínicas, rutinas y turnos.
        </p>
        <p>
          Respecto de los datos del <strong>profesional</strong> (cuenta, contacto, plan contratado), SecretarIA
          es <strong>responsable del tratamiento</strong>. Respecto de los datos de los <strong>pacientes</strong>
          cargados por el profesional (identificatorios y de salud), SecretarIA actúa como
          <strong>encargado del tratamiento</strong>: procesa esos datos únicamente para prestarle el servicio al
          profesional y siguiendo sus instrucciones. El profesional es el responsable del tratamiento de los
          datos de sus pacientes y quien debe recabar el consentimiento informado correspondiente (ver
          Sección 5). Para facilitarlo, ponemos a disposición un
          <a routerLink="/legal/modelo-consentimiento">modelo de consentimiento informado para pacientes</a>.
        </p>

        <h2>2. Datos que recolectamos</h2>
        <h3>2.1. Datos del profesional</h3>
        <ul>
          <li>Nombre, email y contraseña (gestionada por Firebase Authentication, nunca la vemos en texto plano)</li>
          <li>Teléfono y lugares de atención (opcionales, cargados en el perfil)</li>
          <li>Plan contratado y estado de la cuenta</li>
          <li>Token de dispositivo para notificaciones push (si las activás)</li>
        </ul>
        <h3>2.2. Datos de pacientes (cargados por el profesional)</h3>
        <ul>
          <li>Datos identificatorios: nombre, apellido, DNI, fecha de nacimiento, sexo, teléfono, email, obra social, N° de afiliado</li>
          <li>Datos de salud: motivo de consulta, antecedentes, examen físico, exploración postural, signos vitales, diagnóstico, plan terapéutico, estudios complementarios, laboratorio, medicación, observaciones, rutinas de ejercicios y evaluaciones</li>
          <li><strong>Audio de la consulta</strong>, si el profesional decide grabarla para transcribirla automáticamente</li>
        </ul>
        <h3>2.3. Datos técnicos</h3>
        <ul>
          <li>Dirección IP y metadatos de la solicitud (con fines de seguridad y limitación de abuso)</li>
        </ul>

        <h2>3. Finalidades del tratamiento</h2>
        <ul>
          <li>Prestar el servicio de gestión de pacientes e historia clínica digital</li>
          <li>Transcribir y estructurar automáticamente, mediante inteligencia artificial, el audio de las consultas en formato de historia clínica o rutina</li>
          <li>Generar planes terapéuticos/rutinas asistidos por IA a partir de los datos que carga el profesional</li>
          <li>Enviar notificaciones y recordatorios de turnos a los pacientes (por email o push)</li>
          <li>Generar reportes e informes en PDF a pedido del profesional</li>
          <li>Administrar el plan contratado y la facturación</li>
          <li>Seguridad de la plataforma (prevención de abuso, límites de uso)</li>
        </ul>
        <p>No usamos los datos de pacientes con fines publicitarios ni los vendemos a terceros bajo ninguna circunstancia.</p>

        <h2>4. Inteligencia artificial: cómo funciona</h2>
        <p>
          Cuando el profesional graba una consulta, el audio se envía en el momento a nuestro proveedor de
          transcripción y no se guarda de forma permanente en nuestros servidores: se procesa en memoria,
          se transcribe y se descarta inmediatamente. El texto resultante se envía a un modelo de lenguaje
          para estructurarlo en el formato de historia clínica o rutina, y ese texto estructurado sí queda
          almacenado como parte de la historia clínica del paciente (ver Sección 7). El profesional revisa y
          puede corregir cualquier campo antes de guardarlo definitivamente.
        </p>

        <h2>5. Base legal y consentimiento</h2>
        <p>
          Los datos de salud son <strong>datos sensibles</strong> bajo la Ley 25.326, por lo que su tratamiento
          requiere consentimiento expreso e informado del paciente. Dado que SecretarIA es una plataforma B2B
          sin registro directo de pacientes, es <strong>responsabilidad del profesional</strong> informar a sus
          pacientes y obtener ese consentimiento antes de cargar sus datos, grabar una consulta o generar una
          historia clínica asistida por IA — incluyendo la mención de que sus datos pueden ser transferidos a
          proveedores tecnológicos en el exterior (Sección 6). Para eso, el profesional puede usar el
          <a routerLink="/legal/modelo-consentimiento">modelo de consentimiento informado</a> que provee la plataforma,
          adaptarlo, y conservar la constancia firmada según lo exige la normativa de historia clínica (Ley 26.529).
        </p>
        <p>
          El profesional, al registrarse, presta su propio consentimiento expreso a esta Política y a la
          transferencia internacional de datos descripta a continuación, en su carácter de responsable del
          tratamiento de los datos que carga en la plataforma.
        </p>

        <h2>6. A quién transferimos los datos (subencargados)</h2>
        <p>Utilizamos los siguientes proveedores externos para operar el servicio. Ninguno recibe más datos de los estrictamente necesarios para cumplir su función:</p>
        <table>
          <thead><tr><th>Proveedor</th><th>Función</th><th>Ubicación</th><th>Qué recibe</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Groq, Inc.</strong></td>
              <td>Transcripción de audio (Whisper) y estructuración de texto clínico con modelos de lenguaje</td>
              <td>Estados Unidos</td>
              <td>Audio de la consulta (procesado y descartado al instante) y la transcripción de texto</td>
            </tr>
            <tr>
              <td><strong>Google LLC (Firebase / Google Cloud)</strong></td>
              <td>Autenticación de usuarios, base de datos (Firestore), notificaciones push, envío de emails, hosting del frontend</td>
              <td>Estados Unidos / infraestructura global de Google</td>
              <td>Todos los datos almacenados de la cuenta y de los pacientes</td>
            </tr>
            <tr>
              <td><strong>Render Services, Inc.</strong></td>
              <td>Hosting del servidor backend (API)</td>
              <td>Estados Unidos</td>
              <td>Datos en tránsito durante el procesamiento de cada solicitud</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Transferencia internacional:</strong> Estados Unidos no cuenta con una declaración de "nivel
          adecuado de protección" por parte de la Agencia de Acceso a la Información Pública (AAIP) de
          Argentina. Conforme el art. 12 de la Ley 25.326, esta transferencia se realiza en base al
          consentimiento informado prestado por el profesional al aceptar esta política, y que el profesional
          debe, a su vez, hacer constar frente a sus pacientes.
        </p>

        <h2>7. Conservación de los datos</h2>
        <ul>
          <li><strong>Audio de consultas:</strong> no se almacena. Se procesa en memoria durante la transcripción y se elimina inmediatamente después.</li>
          <li><strong>Historias clínicas, rutinas, evaluaciones y turnos:</strong> se conservan mientras la cuenta del profesional esté activa, y en los plazos mínimos que exige la normativa de historia clínica (Ley 26.529, art. 18: mínimo 10 años desde la última actuación).</li>
          <li><strong>Eliminación:</strong> si el profesional elimina un paciente desde la plataforma, se eliminan de forma permanente e inmediata todos sus registros asociados (historias clínicas, rutinas, evaluaciones) de nuestra base de datos.</li>
        </ul>

        <h2>8. Seguridad</h2>
        <ul>
          <li>Toda comunicación viaja cifrada (HTTPS/TLS)</li>
          <li>La autenticación se realiza mediante tokens de Firebase; el backend nunca ve ni almacena contraseñas</li>
          <li>Cada profesional solo puede acceder a los datos de sus propios pacientes: el aislamiento está garantizado a nivel de base de datos, no solo por una validación de la aplicación</li>
          <li>El acceso directo a la base de datos desde el navegador está deshabilitado; todo pasa por un backend autenticado</li>
          <li>Límites de frecuencia (rate limiting) en los endpoints más sensibles para prevenir abuso</li>
        </ul>

        <h2>9. Tus derechos (ARCO)</h2>
        <p>
          Como titular de los datos (profesional o paciente), tenés derecho a <strong>acceder, rectificar,
          actualizar, suprimir y oponerte</strong> al tratamiento de tus datos personales. Si sos paciente,
          podés ejercer estos derechos a través del profesional que te atiende, quien es el responsable de tus
          datos de salud en la plataforma. Si sos profesional, podés ejercerlos escribiendo a
          <strong>{{ contactEmail }}</strong>.
        </p>
        <p>
          Además, tenés derecho a presentar un reclamo ante la <strong>Agencia de Acceso a la Información
          Pública (AAIP)</strong>, autoridad de control de la Ley 25.326 en Argentina
          (<a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener">www.argentina.gob.ar/aaip</a>),
          si considerás que tus derechos fueron vulnerados.
        </p>

        <h2>10. Pacientes menores de edad</h2>
        <p>
          Cuando el paciente sea menor de edad, el consentimiento informado debe ser otorgado por su
          madre, padre o representante legal.
        </p>

        <h2>11. Cookies y almacenamiento local</h2>
        <p>
          La aplicación utiliza el almacenamiento local del navegador (localStorage/IndexedDB) únicamente para
          mantener la sesión iniciada (a través de Firebase Authentication) y guardar preferencias de uso
          (por ejemplo, si ya se envió una notificación diaria). No usamos cookies de rastreo publicitario ni
          compartimos esta información con redes de publicidad.
        </p>

        <h2>12. Cambios a esta política</h2>
        <p>
          Ante cualquier cambio sustancial en esta política (por ejemplo, la incorporación de un nuevo
          proveedor que procese datos de salud), actualizaremos la fecha de versión y solicitaremos al
          profesional que vuelva a aceptarla antes de continuar usando la plataforma.
        </p>

        <h2>13. Contacto</h2>
        <p>
          Responsable del tratamiento: <strong>{{ legalEntity }}</strong><br>
          Contacto para consultas de privacidad: <strong>{{ contactEmail }}</strong>
        </p>

        <div class="placeholder-notice">
          ⚠️ <strong>Pendiente antes de publicar:</strong> completar la identidad legal del responsable
          (nombre/razón social y, si corresponde, CUIT) y un email de contacto dedicado a privacidad.
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-layout { min-height: 100vh; background: linear-gradient(135deg, #f0f4ff 0%, #e8f5f0 100%); padding: 24px 16px; display: flex; justify-content: center; }
    .legal-card { background: white; border-radius: 20px; padding: 40px; width: 100%; max-width: 780px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); box-sizing: border-box; }
    .back-link { display: inline-block; margin-bottom: 20px; color: #16a34a; font-weight: 600; text-decoration: none; font-size: 14px; }
    h1 { font-size: 24px; font-weight: 800; color: #111827; margin: 0 0 4px; }
    .meta { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
    .lead { font-size: 15px; color: #374151; line-height: 1.6; margin-bottom: 24px; }
    h2 { font-size: 17px; font-weight: 700; color: #111827; margin: 28px 0 10px; }
    h3 { font-size: 14px; font-weight: 700; color: #16a34a; margin: 16px 0 6px; }
    p, li { font-size: 14px; color: #374151; line-height: 1.65; }
    ul { padding-left: 20px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    a { color: #16a34a; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f0fdf4; color: #166534; font-weight: 700; }
    .placeholder-notice { margin-top: 32px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 13px; color: #92400e; }
    @media (max-width: 480px) {
      .legal-card { padding: 24px 18px; border-radius: 16px; }
      table, thead, tbody, th, td, tr { display: block; }
      thead { display: none; }
      td { border: none; border-bottom: 1px solid #f3f4f6; }
      td:first-child { font-weight: 700; color: #16a34a; }
    }
  `]
})
export class PrivacyPolicyComponent {
  version = '2026-09-21';
  contactEmail = '[COMPLETAR EMAIL DE CONTACTO]';
  legalEntity = '[COMPLETAR NOMBRE/RAZÓN SOCIAL DEL RESPONSABLE]';
}
