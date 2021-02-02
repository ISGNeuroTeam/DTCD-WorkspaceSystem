pipeline {
    agent any
    environment {
    // id of Nexus credentials in Jenkins
        NEXUS_COMMON_CREDS = credentials('nexus_cred')
    }
    stages {
    // required section
        stage('Test') {
            steps{
                sh '''
                      make test '''
            }
        }
    // required section
        stage ('Build'){
            steps{
                sh '''
		              make build
                      make pack '''
            }

        }
    // required section
        stage ('Delivery'){
            steps{
                script{
                 env.FILE_NAME = sh(script:'ls *gz', returnStdout: true).trim()
                 env.NAME_WEXT = sh(script:"ls *gz | sed -e 's/.tar.gz\$//'", returnStdout: true).trim()
                 env.NAME_BEFORE = sh(script:"ls *gz | sed -e 's/-[0-9].*//'", returnStdout: true).trim()
                 env.BUILD_NUMBER = sh(script:'printf "%04d" $BUILD_NUMBER', returnStdout: true).trim()
                 sh '''
                      curl -v -u $NEXUS_COMMON_CREDS --upload-file $FILE_NAME $NEXUS_REPO_URL/repository/components/$NAME_BEFORE/$NAME_WEXT-$BUILD_NUMBER.tar.gz'''
                }
            }
        }

  }
  // required section
   post {
       always {
            step([$class: 'GitHubCommitStatusSetter'])
       }
       success {
            sh '''echo DOWNLOAD LINK : $NEXUS_REPO_URL/repository/components/$NAME_BEFORE/$NAME_WEXT-$BUILD_NUMBER.tar.gz'''
    }
}
}
