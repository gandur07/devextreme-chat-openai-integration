import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface ChatResponse {
  assistantResponse?: string;
  answer?: string;
  message?: string;
  content?: string;
  threadId?: string | null;
}

export interface EncuestaPayload {
  threadId: string;
  usuarioId: number;
  calificacionAtencion: number;
  calificacionFacilidad: number;
  comentariosAdicionales?: string;
}
export interface RegistroResponse {
  id: number;
}

export interface ChatRequest {
  message: string;
  threadId: string;   // En el primer mensaje envía '' (vacío)
  usuarioId: number;  // Id devuelto por /Registro
}

export interface Departamento {
  id: number;
  nombre: string;
  codigo: string;
}

export interface Municipio {
  id: number;
  nombre: string;
  codigo: string;
  departamentoId: number;
}

export interface RegistroRequest {
  nombresApellidos: string;
  nombreEmpresa: string;
  tipoIdentificacion: number;   // (int)
  numeroIdentificacion: string;
  genero: string;
  municipioId: number;          // (int)
  numeroCelular: string;
  correoElectronico: string;
}

@Injectable({ providedIn: 'root' })
export class AppService {
  private readonly BASE_URL = 'https://localhost:7050/api/AIChat/chat';
  private readonly API_BASE = 'https://localhost:7050/api';

  private profile: any = null;
  public threadId: string | null = null;
  public usuarioId: number | null = null;
  constructor(private http: HttpClient) {
    
  }
  enviarEncuesta(payload: EncuestaPayload): Observable<any> {
    return this.http.post(`${this.API_BASE}/Encuesta`, payload);
  }
  getDepartamentos(): Observable<Departamento[]> {
    return this.http.get<Departamento[]>(`${this.API_BASE}/Usuario/departamentos`);
  }

  getMunicipios(departamentoId: number) {
    return this.http.get<Municipio[]>(
      `${this.API_BASE}/Usuario/departamentos/${departamentoId}/municipios`
      // Si usas proxy, sería: `/api/Usuario/departamentos/${departamentoId}/municipios`
    );
  }
  registrarUsuario(payload: RegistroRequest) {
    // Si usas proxy, cambia a '/api/Usuario/registro'
    return this.http.post(
      `${this.API_BASE}/Usuario/registro`,
      payload,
      { responseType: 'json' } // la API puede devolver text/plain
    );
    // Si siempre devolviera JSON, usarías:  { responseType: 'json' }
  }
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

  getUsuarioId(): number | null { return this.usuarioId; }
  setUsuarioId(id: number | null) {
    console.log('Setting usuarioId:', id);  
    this.usuarioId = id;
    if (id != null) sessionStorage.setItem('usuarioId', String(id));
    else sessionStorage.removeItem('usuarioId');
  }
  

  // ---- Chat API ----
  chat(
    message: string,
    opts?: { profile?: any; survey?: { attention: number; ease: number } }
  ): Observable<ChatResponse> {
    const body: any = { message };
    // solo enviar threadId si existe (primer mensaje puede ir sin él)
    if (this.threadId) body.threadId = this.threadId;
    if (this.usuarioId != null) body.usuarioId = this.usuarioId;
    if (opts?.profile) body.profile = opts.profile;
    if (opts?.survey) body.survey = opts.survey;
    console.log('Sending to API:', body);
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
