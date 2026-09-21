import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-patient-consent',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-layout">
      <div class="toolbar no-print">
        <a routerLink="/login" class="back-link">← Volver</a>
        <button class="btn-print" (click)="print()">🖨️ Imprimir / Guardar como PDF</button>
      </div>

      <div class="legal-card">
        <div class="intro no-print">
          <p>
            Este es un <strong>modelo</strong> de consentimiento informado para que se lo entregues a tus
            pacientes antes de grabar una consulta o cargar sus datos en SecretarIA. Completalo con tus datos,
            imprimilo y guardá la copia firmada junto con la historia clínica del paciente, tal como exige la
            Ley 26.529. Podés adaptar el texto a tu especialidad.
          </p>
        </div>

        <h1>Consentimiento informado para el tratamiento de datos de salud</h1>

        <div class="fill-block">
          <p>Profesional tratante: ______________________________________ Matrícula N°: ____________</p>
          <p>Lugar de atención: ______________________________________________________________</p>
        </div>

        <p>
          Yo, ______________________________________________ (nombre y apellido del paciente),
          DNI N° ____________________, en carácter de paciente
          / ______________________________________________ (representante legal, si el paciente es menor de edad),
          declaro que:
        </p>

        <ol>
          <li>
            He sido informado/a de que mi consulta con el/la profesional mencionado/a puede ser
            <strong>grabada en audio</strong> con el fin de registrar mi historia clínica.
          </li>
          <li>
            Esa grabación se transcribe y estructura de forma automática mediante servicios de
            <strong>inteligencia artificial de terceros</strong> (el proveedor Groq, con servidores ubicados en
            Estados Unidos). El audio se procesa en el momento y <strong>no queda almacenado</strong>; solo el
            texto resultante pasa a formar parte de mi historia clínica.
          </li>
          <li>
            Mis datos personales y de salud (identificación, antecedentes, diagnóstico, tratamiento, estudios,
            medicación y demás información clínica) se almacenan de forma segura en la plataforma SecretarIA,
            que utiliza infraestructura de Google Firebase, y son accesibles únicamente por mi profesional
            tratante.
          </li>
          <li>
            El profesional tratante revisa y valida toda la información generada automáticamente antes de
            incorporarla a mi historia clínica; la inteligencia artificial es una asistencia y no reemplaza su
            criterio profesional.
          </li>
          <li>
            Puedo ejercer en cualquier momento mis derechos de acceso, rectificación, actualización, supresión
            y oposición sobre mis datos, dirigiéndome a mi profesional tratante, y presentar un reclamo ante la
            Agencia de Acceso a la Información Pública (AAIP) si lo considero necesario.
          </li>
          <li>
            Presto mi consentimiento libre, expreso e informado para el tratamiento de mis datos de salud
            descripto en este documento, incluyendo su procesamiento por proveedores tecnológicos ubicados en
            el exterior mencionados en el punto 2.
          </li>
        </ol>

        <div class="signature-block">
          <div class="sign-col">
            <div class="sign-line"></div>
            <p>Firma del paciente / representante legal</p>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <p>Aclaración y DNI</p>
          </div>
          <div class="sign-col">
            <div class="sign-line"></div>
            <p>Fecha</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-layout { min-height: 100vh; background: linear-gradient(135deg, #f0f4ff 0%, #e8f5f0 100%); padding: 24px 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
    .toolbar { width: 100%; max-width: 780px; display: flex; justify-content: space-between; align-items: center; }
    .back-link { color: #16a34a; font-weight: 600; text-decoration: none; font-size: 14px; }
    .btn-print { padding: 10px 16px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-print:hover { background: #15803d; }
    .legal-card { background: white; border-radius: 20px; padding: 40px; width: 100%; max-width: 780px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); box-sizing: border-box; }
    .intro { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #166534; margin-bottom: 24px; }
    h1 { font-size: 19px; font-weight: 800; color: #111827; text-align: center; margin: 0 0 24px; }
    .fill-block p { margin: 6px 0; font-weight: 600; }
    p, li { font-size: 14px; color: #374151; line-height: 1.75; }
    ol { padding-left: 20px; }
    li { margin-bottom: 10px; }
    .signature-block { display: flex; gap: 24px; margin-top: 56px; flex-wrap: wrap; }
    .sign-col { flex: 1; min-width: 160px; text-align: center; }
    .sign-line { border-bottom: 1.5px solid #111827; height: 40px; margin-bottom: 6px; }
    .sign-col p { font-size: 12px; color: #6b7280; }
    @media (max-width: 480px) {
      .legal-card { padding: 24px 18px; border-radius: 16px; }
      .toolbar { flex-direction: column; gap: 10px; align-items: stretch; }
      .btn-print { width: 100%; }
    }
    @media print {
      .no-print { display: none !important; }
      .legal-layout { background: white; padding: 0; }
      .legal-card { box-shadow: none; padding: 0; max-width: none; }
    }
  `]
})
export class PatientConsentComponent {
  print() {
    window.print();
  }
}
