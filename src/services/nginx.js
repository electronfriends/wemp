import BaseService from './base-service';

class Nginx extends BaseService {
  constructor() {
    super('Nginx', 'nginx.exe');
  }
}

export default Nginx;
