import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  active?: boolean;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard', active: false },
    { label: 'Navegador', icon: 'pi pi-globe', route: '/navegador', active: false }, // Novo item de menu
    { label: 'Resumos', icon: 'pi pi-file', route: '/resumos', active: false },
    { label: 'Pesquisar', icon: 'pi pi-search', route: '/pesquisa', active: false },
    { label: 'Perguntas Salvas', icon: 'pi pi-question-circle', route: '/perguntas', active: false },
    { label: 'Guia do Professor', icon: 'pi pi-user', route: '/professor', active: false },
    { label: 'Administração', icon: 'pi pi-cog', route: '/admin', active: false },
  ];

  constructor(private router: Router) {
    // Atualiza o item ativo com base na rota atual
    this.updateActiveItem(this.router.url);
    
    // Inscreve-se para eventos de navegação para manter o item ativo atualizado
    this.router.events.subscribe(() => {
      this.updateActiveItem(this.router.url);
    });
  }

  // Atualiza o item ativo com base na rota atual
  updateActiveItem(currentRoute: string) {
    this.menuItems.forEach(item => {
      item.active = item.route === currentRoute;
    });
  }

  // Navega para a rota selecionada
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  // Faz logout e retorna para a tela de login
  logout() {
    this.router.navigate(['/login']);
  }
}