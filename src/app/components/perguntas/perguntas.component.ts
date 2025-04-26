import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';

interface Pergunta {
  id: number;
  pergunta: string;
  resposta: string;
  disciplina: string;
  modulo: string;
}

@Component({
  selector: 'app-perguntas',
  templateUrl: './perguntas.component.html',
  styleUrls: ['./perguntas.component.scss']
})
export class PerguntasComponent implements OnInit {
  perguntas: Pergunta[] = [];
  perguntaAtual: Pergunta | null = null;
  respostaVisivel: boolean = false;
  disciplinasFiltro: any[] = [];
  modulosFiltro: any[] = [];
  disciplinaSelecionada: string | null = null;
  moduloSelecionado: string | null = null;

  constructor(private databaseService: DatabaseService) {}

  async ngOnInit() {
    await this.carregarPerguntas();
    this.configurarFiltros();
    this.selecionarPerguntaAleatoria();
  }

  async carregarPerguntas() {
    try {
      this.perguntas = await this.databaseService.getPerguntas();
      // Filtrar por disciplina e módulo se selecionados
      if (this.disciplinaSelecionada) {
        this.perguntas = this.perguntas.filter(p => p.disciplina === this.disciplinaSelecionada);
      }
      if (this.moduloSelecionado) {
        this.perguntas = this.perguntas.filter(p => p.modulo === this.moduloSelecionado);
      }
    } catch (error) {
      console.error('Erro ao carregar perguntas:', error);
    }
  }

  configurarFiltros() {
    // Extrair disciplinas únicas
    const disciplinas = [...new Set(this.perguntas.map(p => p.disciplina))];
    this.disciplinasFiltro = disciplinas.map(d => ({ label: d, value: d }));

    // Extrair módulos únicos
    const modulos = [...new Set(this.perguntas.map(p => p.modulo))];
    this.modulosFiltro = modulos.map(m => ({ label: m, value: m }));
  }

  selecionarPerguntaAleatoria() {
    if (this.perguntas.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.perguntas.length);
      this.perguntaAtual = this.perguntas[randomIndex];
      this.respostaVisivel = false;
    } else {
      this.perguntaAtual = null;
    }
  }

  mostrarResposta() {
    this.respostaVisivel = true;
  }

  proximaPergunta() {
    this.selecionarPerguntaAleatoria();
  }

  async aplicarFiltros() {
    await this.carregarPerguntas();
    this.selecionarPerguntaAleatoria();
  }

  limparFiltros() {
    this.disciplinaSelecionada = null;
    this.moduloSelecionado = null;
    this.carregarPerguntas();
  }
}