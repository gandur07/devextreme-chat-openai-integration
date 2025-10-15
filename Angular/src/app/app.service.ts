
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatRequestFirst {
  message: string;         // primera interacción (sin threadId)
}
export interface ChatRequestNext extends ChatRequestFirst {
  threadId: string;        // siguientes interacciones
}
export interface ChatResponse {
  threadId: string;
  assistantResponse: string;
}

@Injectable({ providedIn: 'root' })
export class AppService {
  // Ajusta el endpoint si corresponde (http/https/host/puerto)
  private readonly BASE_URL = 'https://localhost:7050/api/AIChat/chat';

  constructor(private http: HttpClient) { }

  sendChat(message: string, threadId?: string): Observable<ChatResponse> {
    const body: ChatRequestFirst | ChatRequestNext = threadId
      ? { message, threadId }
      : { message };
    return this.http.post<ChatResponse>(this.BASE_URL, body);
  }
}

