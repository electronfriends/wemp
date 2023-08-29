import BaseService from './base-service';

class Php extends BaseService {
  constructor() {
    super('PHP', 'php-cgi.exe', ['-b', '127.0.0.1:9000'], '', true);
  }
}

export default Php;
