import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';

interface Activity {
  id: number;
  titulo: string;
  descricao: string;
  modulo: string;
  disciplina: string;
  status: string;
  nota: number | null;
  prazo: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  activities: Activity[] = [];
  completedActivities: number = 0;
  pendingActivities: number = 0;
  averageGrade: number = 0;

  constructor(private databaseService: DatabaseService) {}

  async ngOnInit() {
    await this.loadActivities();
    this.calculateStatistics();
  }

  async loadActivities() {
    try {
      this.activities = await this.databaseService.getActivities();
      // Ordena as atividades por prazo
      this.activities.sort((a, b) => {
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      });
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    }
  }

  calculateStatistics() {
    // Calcula o número de atividades concluídas e pendentes
    this.completedActivities = this.activities.filter(a => a.status === 'Concluído').length;
    this.pendingActivities = this.activities.filter(a => a.status === 'Pendente').length;

    // Calcula a média das notas das atividades concluídas
    const completedWithGrades = this.activities.filter(a => a.status === 'Concluído' && a.nota !== null);
    if (completedWithGrades.length > 0) {
      const sum = completedWithGrades.reduce((acc, curr) => acc + (curr.nota || 0), 0);
      this.averageGrade = parseFloat((sum / completedWithGrades.length).toFixed(1));
    }
  }

  navigateToResumes() {
    // Implementação futura
  }

  navigateToQuestions() {
    // Implementação futura
  }
}