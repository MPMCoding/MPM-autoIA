import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';

interface Resumo {
  id: number;
  titulo: string;
  disciplina: string;
  modulo: string;
  conteudo: string;
}

@Component({
  selector: 'app-resumos',
  templateUrl: './resumos.component.html',
  styleUrls: ['./resumos.component.scss']
})
export class ResumosComponent implements OnInit {
  resumos: Resumo[] = [];
  disciplinasFiltro: any[] = [];
  modulosFiltro: any[] = [];
  disciplinaSelecionada: string | null = null;
  moduloSelecionado: string | null = null;

  constructor(private databaseService: DatabaseService) {}

  async ngOnInit() {
    await this.carregarResumos();
    this.configurarFiltros();
  }

  async carregarResumos() {
    try {
      this.resumos = await this.databaseService.getResumos(
        this.disciplinaSelecionada || undefined,
        this.moduloSelecionado || undefined
      );
    } catch (error) {
      console.error('Erro ao carregar resumos:', error);
    }
  }

  configurarFiltros() {
    // Extrair disciplinas únicas
    const disciplinas = [...new Set(this.resumos.map(r => r.disciplina))];
    this.disciplinasFiltro = disciplinas.map(d => ({ label: d, value: d }));

    // Extrair módulos únicos
    const modulos = [...new Set(this.resumos.map(r => r.modulo))];
    this.modulosFiltro = modulos.map(m => ({ label: m, value: m }));
  }

  async filtrarPorDisciplina() {
    await this.carregarResumos();
  }

  async filtrarPorModulo() {
    await this.carregarResumos();
  }

  limparFiltros() {
    this.disciplinaSelecionada = null;
    this.moduloSelecionado = null;
    this.carregarResumos();
  }
}