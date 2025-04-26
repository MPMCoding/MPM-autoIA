import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

// Componentes da aplicação
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ResumosComponent } from './components/resumos/resumos.component';
import { PesquisaComponent } from './components/pesquisa/pesquisa.component';
import { PerguntasComponent } from './components/perguntas/perguntas.component';
import { ProfessorComponent } from './components/professor/professor.component';
import { AdminComponent } from './components/admin/admin.component';
import { NavegadorComponent } from './components/navegador/navegador.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

// Diretivas
import { WebviewDirective } from './directives/webview.directive';

// Módulos do PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MenuModule } from 'primeng/menu';
import { TabMenuModule } from 'primeng/tabmenu';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ChartModule } from 'primeng/chart';
import { MessageModule } from 'primeng/message';

// Serviços
import { DatabaseService } from './services/database.service';
import { ElectronService } from './services/electron.service';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'resumos', component: ResumosComponent },
  { path: 'pesquisa', component: PesquisaComponent },
  { path: 'perguntas', component: PerguntasComponent },
  { path: 'professor', component: ProfessorComponent },
  { path: 'admin', component: AdminComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    ResumosComponent,
    PesquisaComponent,
    PerguntasComponent,
    ProfessorComponent,
    AdminComponent,
    NavegadorComponent,
    SidebarComponent,
    WebviewDirective
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes, { useHash: true }),
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MenuModule,
    TabMenuModule,
    TableModule,
    DropdownModule,
    DialogModule,
    ToastModule,
    ChartModule,
    MessageModule
  ],
  providers: [
    MessageService,
    DatabaseService,
    ElectronService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }