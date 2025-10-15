
import { Component } from '@angular/core';
import { AppService, ChatResponse } from './app.service';
import { BehaviorSubject } from 'rxjs';
interface ChatMessage {
  id: string;
  text: string;
  user: any; // ajusta al tipo de dx-chat si lo tienes tipado
  timestamp?: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  //styleUrls: ['./app.component.css']
})
export class AppComponent {
  // dx-chat bindings ya existen en tu HTML
  dataSource: ChatMessage[] = [];
  user = { id: 1, name: 'Yo' };          // tu usuario local
  bot = { id: 2, name: 'Asistente' };   // “bot” para mensajes de respuesta
  typingUsers$ = new BehaviorSubject<any[]>([]);
  alerts$ = new BehaviorSubject<any[]>([]);
  isDisabled = false;
  regenerationText = 'Regenerating…';
  copyButtonIcon = 'copy';

  // 🔑 aquí guardamos el hilo
  private threadId?: string;

  constructor(private api: AppService) { }

  // dx-chat: se dispara cuando el usuario envía un mensaje
  onMessageEntered(e: any) {
  //onMessageEntered(e: { message: { text: string } }) {
    const text = (e?.message?.text || '').trim();
    if (!text) { return; }

    // pinta el mensaje del usuario
    //this.pushUser(text);

    // bloquea el chat mientras responde la API
    this.isDisabled = true;

    this.api.sendChat(text, this.threadId).subscribe({
      next: (res: ChatResponse) => {
        // guarda el threadId devuelto por la API (primera vez o refrescado)
        this.threadId = res.threadId;
        // muestra la respuesta del asistente
        this.pushBot(res.assistantResponse);
      },
      error: (err) => {
        this.pushBot('⚠️ Ocurrió un error llamando la API.');
        // si quieres, log: console.error(err);
      },
      complete: () => {
        this.isDisabled = false;
      }
    });
  }

  // botones auxiliares ya referenciados en tu template
  onRegenerateButtonClick() {
    // ejemplo simple: reenvía el último mensaje del usuario si existe
    const lastUser = [...this.dataSource].reverse().find(m => m.user?.id === this.user.id);
    if (!lastUser) { return; }
    this.onMessageEntered({ message: { text: lastUser.text } });
  }

  onCopyButtonClick(msg: ChatMessage) {
    navigator.clipboard?.writeText(msg.text);
  }

  // utilidades
  convertToHtml(m: any): string {
    // si tu API puede devolver markdown, aquí podrías convertir;
    // por ahora, retorna texto escapado simple:
    const div = document.createElement('div');
    div.innerText = m.text ?? '';
    return div.innerHTML;
  }

  private pushUser(text: string) {
    this.dataSource = [
      ...this.dataSource,
      { id: crypto.randomUUID(), text, user: this.user, timestamp: new Date() }
    ];
  }

  private pushBot(text: string) {
    this.dataSource = [
      ...this.dataSource,
      { id: crypto.randomUUID(), text, user: this.bot, timestamp: new Date() }
    ];
  }
}

