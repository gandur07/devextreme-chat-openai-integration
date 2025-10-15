import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppService, ChatResponse } from './app.service';

// Tipos de mensajes para el chat
type MessageKind = 'welcome' | 'form' | 'options' | 'survey' | 'text';

interface ChatMessage {
  id?: string;
  type?: MessageKind;
  text?: string;
  role?: 'user' | 'assistant' | 'system';
  createdAt?: Date;
  payload?: any;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  // styleUrls: ['./app.component.css'],
  // Usa estilos inline para no depender del loader de CSS
  styles: [`
    .bubble-card{background:#fff;border:1px solid #eee;border-radius:12px;padding:14px;max-width:520px}
    .bubble-card.form .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;margin:10px 0}
    .bubble-card form label{display:flex;flex-direction:column;font-size:14px;gap:6px}
    .bubble-card input,.bubble-card select{padding:8px 10px;border:1px solid #e1e1e1;border-radius:8px}
    .bubble-card .checkbox{display:flex;gap:8px;margin-top:8px}
    .bubble-card .actions{margin-top:10px}
    .btn-primary{background:#0a6cff;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer}
    .btn-outline{background:#fff;color:#0a6cff;border:1px solid #0a6cff;border-radius:8px;padding:8px 12px;cursor:pointer}
    .logo{height:48px;margin-bottom:6px}
    .options{display:flex;gap:8px}
    .survey .survey-row{margin:10px 0}
    .thanks{margin-top:8px;color:#2a7a2a;font-weight:600}
  `]
})
export class AppComponent implements OnInit {

  // ---- Chat / dx-chat ----
  isDisabled = false;
  dataSource: ChatMessage[] = [];
  user = { id: 1, name: 'Unknown User' };
  typingUsers$: any = null;
  alerts$: any = null;
  regenerationText = '__regen__';
  copyButtonIcon = 'copy';

  // ---- Logo ----
  vicoLogoUrl = 'assets/vico-logo.png';

  // ---- Formulario de bienvenida ----
  welcomeForm!: FormGroup;
  departamentos: string[] = ['Bogotá D.C.', 'Antioquia', 'Valle del Cauca'];
  mapaMunicipios: { [k: string]: string[] } = {
    'Bogotá D.C.': ['Bogotá'],
    'Antioquia': ['Medellín', 'Bello', 'Itagüí'],
    'Valle del Cauca': ['Cali', 'Palmira', 'Jamundí']
  };
  municipios: string[] = [];

  // ---- Encuesta ----
  survey: { attention?: number; ease?: number } = {};
  surveySubmitted = false;

  // ---- Control de interacción ----
  isChatLocked = true; // bloqueado hasta "Siguiente"
  threadId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: AppService
  ) { }

  ngOnInit(): void {
    this.buildForm();
    // Mensaje de bienvenida y burbuja con formulario
    this.pushMessage({ type: 'welcome', role: 'system', text: '¡Hola! Antes de empezar, por favor completa este formulario.' });
    this.pushMessage({ type: 'form', role: 'assistant' });
  }

  // =======================
  // Formulario
  // =======================
  private buildForm(): void {
    this.welcomeForm = this.fb.group({
      nombresApellidos: ['', [Validators.required, Validators.minLength(3)]],
      nombreEmpresa: [''],
      tipoIdentificacion: ['', Validators.required],
      numeroIdentificacion: ['', Validators.required],
      genero: [''],
      departamentoId: ['', Validators.required],
      municipioId: ['', Validators.required],
      numeroCelular: [''],
      correoElectronico: ['', [Validators.email]],
      acceptTerms: [false, Validators.requiredTrue],
    });
  }


  onDepartmentChange(): void {
    // Valor seleccionado del <select> de Departamento (id o nombre, según tu data)
    const depVal = this.welcomeForm?.get('departamentoId')?.value;

    // Intenta resolver municipios tanto si el mapa está por id (número o string) como por nombre
    const posiblesClaves = [
      depVal,                     // p.ej. 3
      String(depVal),             // "3"
      (this as any).departamentosNombrePorId?.[depVal] // p.ej. "Bogotá D.C." si tienes este diccionario
    ].filter(Boolean);

    let lista: string[] = [];
    for (const k of posiblesClaves) {
      if (this.mapaMunicipios && this.mapaMunicipios[k]) {
        lista = this.mapaMunicipios[k];
        break;
      }
    }

    this.municipios = Array.isArray(lista) ? lista : [];
    // Reinicia el municipio seleccionado con el nuevo nombre del control
    this.welcomeForm?.patchValue({ municipioId: '' });
  }

  onWelcomeSubmit(): void {
    if (!this.welcomeForm || this.welcomeForm.invalid) return;

    // Desbloquear chat
    this.isChatLocked = false;

    // Quitar la burbuja del formulario
    this.removeFirstOfType('form');
    console.log('Profile submitted', this.welcomeForm.value);
    // Confirmación
    var name = this.welcomeForm.value && this.welcomeForm.value.fullName ? this.welcomeForm.value.fullName : '';
    this.pushMessage({ type: 'text', role: 'assistant', text: '¡Gracias, ' + name + '! Ya puedes hacer tus preguntas.' });
    this.pushMessage({ type: 'options', role: 'assistant', text: 'Ejemplos: "¿Cómo presento una PQRS?" · "Quiero un asesor"' });
  }

  // =======================
  // Chat
  // =======================
  onMessageEntered(e: any): void {
    var raw = e && e.message ? e.message : '';
    var text = typeof raw === 'string'
      ? raw
      : (raw && raw.text ? raw.text :
        (raw && raw.content ? raw.content :
          (raw && raw.message ? raw.message :
            (raw && raw.value ? raw.value : ''))));

    text = (text || '').toString().trim();
    if (!text) return;

    if (this.isChatLocked) {
      this.pushMessage({
        type: 'text',
        role: 'assistant',
        text: 'Primero completa el formulario y pulsa **Siguiente** para comenzar 🙌'
      });
      return;
    }

    // Usuario
    //this.pushMessage({ type: 'text', role: 'user', text: text });

    // Llamada al backend (firma: chat(message: string, opts?))
    this.api.chat(text).subscribe({
      next: (res: ChatResponse) => {
        if (res && (res as any).threadId) {
          this.threadId = (res as any).threadId as any;
        }

        // ⬇️ Toma el texto desde assistantResponse, con fallback a otros nombres por si cambia
        var content = '';
        if (res && (res as any).assistantResponse) {
          content = (res as any).assistantResponse;
        } else if ((res as any).content) {
          content = (res as any).content;
        } else if ((res as any).text) {
          content = (res as any).text;
        }
        content = (content || '').toString().trim();

        this.pushMessage({
          type: 'text',
          role: 'assistant',
          text: content || '🤖 (Respuesta vacía)'
        });
      },
      error: () => {
        this.pushMessage({ type: 'text', role: 'assistant', text: 'Hubo un problema procesando tu mensaje. Intenta nuevamente.' });
      }
    });
  }

  sendQuick(text: string): void {
    if (this.isChatLocked) return;
    this.pushMessage({ type: 'text', role: 'user', text: text });
    this.api.chat(text).subscribe({
      next: (res: ChatResponse) => {
        if (res && (res as any).threadId) {
          this.threadId = (res as any).threadId as any;
        }
        var content = this.extractAssistantText(res);
        content = (content || '').toString().trim();
        this.pushMessage({ type: 'text', role: 'assistant', text: content || '🤖 (Respuesta vacía)' });
      },
      error: () => {
        this.pushMessage({ type: 'text', role: 'assistant', text: 'No pude procesar esa opción, intenta de nuevo.' });
      }
    });
  }

  openAgent(): void {
    if (this.isChatLocked) return;
    this.pushMessage({ type: 'text', role: 'assistant', text: 'Te conecto con un agente humano…' });
  }

  // =======================
  // Encuesta (opcional)
  // =======================
  setSurvey(field: 'attention' | 'ease', val: number): void {
    this.survey[field] = val;
  }
  isSurveyComplete(): boolean {
    return !!this.survey.attention && !!this.survey.ease;
  }
  submitSurvey(): void {
    if (!this.isSurveyComplete()) return;
    this.surveySubmitted = true;
  }

  // =======================
  // Utilidades timeline
  // =======================
  private pushMessage(msg: ChatMessage): void {
    const item: ChatMessage = { createdAt: new Date(), ...msg };
    this.dataSource = this.dataSource.concat([item]);
  }

  private removeFirstOfType(type: MessageKind): void {
    var idx = -1;
    for (var i = 0; i < this.dataSource.length; i++) {
      if (this.dataSource[i].type === type) { idx = i; break; }
    }
    if (idx >= 0) {
      this.dataSource = this.dataSource.slice(0, idx).concat(this.dataSource.slice(idx + 1));
    }
  }

  // Extrae texto del shape que devuelva tu backend (sin optional chaining)
  private extractAssistantText(res: any): string {
    if (!res) return '';
    var direct = (res as any).content || (res as any).text || (res as any).answer ||
      (res as any).reply || (res as any).message || (res as any).output ||
      (res as any).result;
    if (typeof direct === 'string' && direct.trim()) return direct;

    var data = (res as any).data || null;
    if (data) {
      var nested = (data as any).content || (data as any).text || (data as any).answer;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }

    var choices = (res as any).choices || null;
    if (choices && choices.length > 0) {
      var c0 = choices[0];
      var msg = c0 && c0.message ? c0.message.content : null;
      if (typeof msg === 'string' && msg.trim()) return msg;
      var txt = c0 && c0.text ? c0.text : null;
      if (typeof txt === 'string' && txt.trim()) return txt;
    }

    var outText = (res as any).output_text || (res as any).output && (res as any).output.text;
    if (typeof outText === 'string' && outText.trim()) return outText;

    var arr = (res as any).content;
    if (arr && arr instanceof Array) {
      var parts = [];
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i];
        var t = it && (it.text || it.content);
        if (t) parts.push(t);
      }
      var joined = parts.join('\\n');
      if (joined.trim()) return joined;
    }

    return '';
  }

  // Helpers que podría usar tu template
  convertToHtml(m: any): string {
    return typeof m === 'string' ? m : (m && m.text ? m.text : '');
  }
  onCopyButtonClick(_m: any): void { }
  onRegenerateButtonClick(): void { }
}
