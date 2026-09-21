import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-layout">
      <div class="legal-card">
        <a routerLink="/login" class="back-link">← Volver</a>
        <h1>Términos y Condiciones de SecretarIA</h1>
        <p class="meta">Versión vigente: <strong>{{ version }}</strong> — Última actualización: {{ version }}</p>

        <h2>1. Aceptación</h2>
        <p>
          Al crear una cuenta en SecretarIA aceptás estos Términos y Condiciones y nuestra
          <a routerLink="/legal/privacidad">Política de Privacidad</a>. Si no estás de acuerdo, no debés
          utilizar la plataforma.
        </p>

        <h2>2. Quién puede usar el servicio</h2>
        <p>
          SecretarIA es una plataforma de uso exclusivamente profesional, destinada a
          <strong>profesionales de la salud</strong>. Al registrarte declarás que:
        </p>
        <ul>
          <li>Sos mayor de edad y contás con la matrícula profesional habilitante para tu actividad</li>
          <li>Los datos que cargás sobre vos y sobre tus pacientes son veraces y exactos</li>
          <li>Usarás la plataforma exclusivamente para fines profesionales lícitos</li>
        </ul>

        <h2>3. Descripción del servicio</h2>
        <p>
          SecretarIA es una herramienta de gestión de pacientes que permite, entre otras funciones: administrar
          fichas de pacientes, generar historias clínicas y rutinas asistidas por inteligencia artificial a
          partir de audio o texto, gestionar turnos y exportar reportes en PDF. La estructuración por IA es una
          <strong>asistencia de redacción</strong>, no un servicio médico ni un diagnóstico automatizado.
        </p>

        <h2>4. Tus responsabilidades como profesional</h2>
        <ul>
          <li>
            <strong>Consentimiento de tus pacientes:</strong> sos responsable de informar a tus pacientes y
            obtener su consentimiento informado antes de grabar una consulta, cargar sus datos de salud, o
            generar una historia clínica asistida por IA — incluyendo que sus datos pueden procesarse por
            proveedores tecnológicos en el exterior. Te proveemos un
            <a routerLink="/legal/modelo-consentimiento">modelo de consentimiento informado</a> para facilitarlo,
            y debés conservar la constancia firmada conforme la Ley 26.529.
          </li>
          <li>
            <strong>Revisión del contenido generado por IA:</strong> todo texto, diagnóstico presuntivo, rutina
            o dato estructurado por inteligencia artificial debe ser <strong>revisado, corregido y validado por
            vos</strong> antes de incorporarlo a la historia clínica oficial del paciente o de utilizarlo para
            tomar decisiones clínicas. La IA puede cometer errores o generar interpretaciones incorrectas del
            audio.
          </li>
          <li>Cumplir con las normas deontológicas y profesionales de tu matrícula respecto del manejo de historias clínicas.</li>
          <li>Mantener la confidencialidad de tu contraseña y notificarnos ante cualquier uso no autorizado de tu cuenta.</li>
        </ul>

        <h2>5. Rol de SecretarIA</h2>
        <p>
          SecretarIA es un proveedor de tecnología. No presta servicios de salud, no emite diagnósticos, no
          reemplaza el criterio clínico profesional y no es parte de la relación entre el profesional y su
          paciente. Actuamos como encargado del tratamiento técnico de los datos que el profesional carga en la
          plataforma, conforme lo detallado en la <a routerLink="/legal/privacidad">Política de Privacidad</a>.
        </p>

        <h2>6. Límites de responsabilidad</h2>
        <ul>
          <li>No garantizamos que las transcripciones o estructuraciones generadas por IA sean 100% exactas.</li>
          <li>No somos responsables por decisiones clínicas, diagnósticos o tratamientos adoptados por el profesional, con o sin asistencia de la plataforma.</li>
          <li>El servicio depende de proveedores externos (Groq, Google Firebase, Render) cuya disponibilidad no controlamos; no garantizamos disponibilidad ininterrumpida (sin SLA).</li>
          <li>En la medida permitida por la ley, nuestra responsabilidad económica frente al profesional se limita al monto efectivamente abonado por el plan contratado en los últimos 3 meses.</li>
        </ul>

        <h2>7. Planes y pagos</h2>
        <p>
          El servicio se ofrece bajo distintos planes con funcionalidades diferenciadas. El plan asignado a
          cada cuenta puede ser modificado por la administración de SecretarIA. Las condiciones de pago,
          renovación y cancelación se informan al momento de la contratación de cada plan.
        </p>

        <h2>8. Propiedad de los datos</h2>
        <p>
          Los datos que cargás sobre vos y tus pacientes te pertenecen. SecretarIA no los utiliza para fines
          distintos de prestarte el servicio contratado, y no los cede ni vende a terceros. Podés solicitar la
          exportación o eliminación de tus datos y los de tus pacientes en cualquier momento, escribiendo a
          <strong>{{ contactEmail }}</strong>, o eliminándolos vos mismo desde la plataforma.
        </p>

        <h2>9. Suspensión y terminación</h2>
        <p>
          Podemos suspender o cancelar una cuenta que incumpla estos Términos, realice un uso indebido de la
          plataforma o de los servicios de inteligencia artificial integrados. El profesional puede dar de baja
          su cuenta en cualquier momento.
        </p>

        <h2>10. Modificaciones</h2>
        <p>
          Podemos actualizar estos Términos. Los cambios sustanciales se notificarán y requerirán una nueva
          aceptación para seguir usando la plataforma.
        </p>

        <h2>11. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia, las
          partes se someten a los tribunales ordinarios de <strong>{{ jurisdiction }}</strong>, renunciando a
          cualquier otro fuero que pudiera corresponder.
        </p>

        <h2>12. Contacto</h2>
        <p>Consultas sobre estos Términos: <strong>{{ contactEmail }}</strong></p>

        <div class="placeholder-notice">
          ⚠️ <strong>Pendiente antes de publicar:</strong> completar la jurisdicción/ciudad competente, el email
          de contacto, y revisar la cláusula de límite de responsabilidad y planes/pagos con un abogado antes
          de empezar a facturar a terceros.
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
    h2 { font-size: 17px; font-weight: 700; color: #111827; margin: 28px 0 10px; }
    p, li { font-size: 14px; color: #374151; line-height: 1.65; }
    ul { padding-left: 20px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    a { color: #16a34a; }
    .placeholder-notice { margin-top: 32px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 13px; color: #92400e; }
    @media (max-width: 480px) { .legal-card { padding: 24px 18px; border-radius: 16px; } }
  `]
})
export class TermsComponent {
  version = '2026-09-21';
  contactEmail = '[COMPLETAR EMAIL DE CONTACTO]';
  jurisdiction = '[COMPLETAR CIUDAD/JURISDICCIÓN]';
}
