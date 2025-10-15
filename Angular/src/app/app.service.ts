import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface ChatResponse {
  assistantResponse?: string;
  answer?: string;
  message?: string;
  content?: string;
  threadId?: string | null;   // <- la API devuelve el threadId vigente
}

@Injectable({ providedIn: 'root' })
export class AppService {
  private readonly BASE_URL = 'https://localhost:7050/api/AIChat/chat';

  private profile: any = null;
  // guarda el hilo en memoria + localStorage para persistir
  private threadId: string | null = localStorage.getItem('ai_thread_id');

  constructor(private http: HttpClient) { }

  // ---- Perfil / encuesta opcional ----
  saveProfile(p: any) { this.profile = p; }
  getProfile() { return this.profile; }
  saveSurvey(s: { attention: number; ease: number }) { console.log('Survey saved', s); }

  // ---- Thread helpers ----
  getThreadId(): string | null { return this.threadId; }
  setThreadId(id: string) {
    this.threadId = id;
    localStorage.setItem('ai_thread_id', id);
  }
  resetThread() {
    this.threadId = null;
    localStorage.removeItem('ai_thread_id');
  }

  // ---- Chat API ----
  chat(
    message: string,
    opts?: { profile?: any; survey?: { attention: number; ease: number } }
  ): Observable<ChatResponse> {
    const body: any = { message };
    // solo enviar threadId si existe (primer mensaje puede ir sin él)
    if (this.threadId) body.threadId = this.threadId;
    if (opts?.profile) body.profile = opts.profile;
    if (opts?.survey) body.survey = opts.survey;

    return this.http.post<ChatResponse>(this.BASE_URL, body).pipe(
      tap((res) => {
        // si el backend devuelve un threadId (nuevo o el mismo), lo persistimos
        if (res?.threadId && res.threadId !== this.threadId) {
          this.setThreadId(res.threadId);
        }
      })
    );
  }
}
